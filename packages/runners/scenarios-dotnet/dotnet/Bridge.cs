using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using System.Collections;
using System.Globalization;
using System.Reflection;
using System.Runtime.Loader;
using System.Text;
using System.Text.Json;
using FocusedSpec.Scenarios;

const int TransportLimit = 4_000_000;
var json = new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };
if (args.Length != 3) throw new InvalidOperationException("bridge requires request, report, and cancellation paths");
var request = JsonSerializer.Deserialize<Request>(await ReadBoundedAsync(args[0]), json) ?? throw new InvalidOperationException("invalid bridge request");
if (request.Protocol != 1 || request.Inventory.Count == 0 || request.Selected.Count == 0) throw new InvalidOperationException("invalid bridge request");
using var cancellation = new CancellationTokenSource();
Console.CancelKeyPress += (_, eventArgs) => { eventArgs.Cancel = true; cancellation.Cancel(); };
var cancellationWatch = WatchCancellationAsync(args[2], cancellation);
try
{
    var suiteType = FindType(request.SuiteType);
    var suiteField = suiteType.GetField(request.SuiteMember, BindingFlags.Public | BindingFlags.Static)
        ?? throw new InvalidOperationException($"runtime suite field not found: {request.SuiteType}.{request.SuiteMember}");
    var suite = suiteField.GetValue(null) ?? throw new InvalidOperationException("runtime suite field returned null");
    var suiteArguments = GenericArguments(suite.GetType(), typeof(ScenarioSuite<,,>), "runtime suite");
    ValidateBinding(suite, request.DriverPath, request.DriverExport);
    ValidateInventory(suite, request.Inventory);

    var split = request.DriverExport.LastIndexOf('.');
    if (split <= 0) throw new InvalidOperationException("invalid runtime driver export");
    var driverType = FindType(request.DriverExport[..split]);
    var driverName = request.DriverExport[(split + 1)..];
    object? driver = driverType.GetField(driverName, BindingFlags.Public | BindingFlags.Static)?.GetValue(null);
    var property = driverType.GetProperty(driverName, BindingFlags.Public | BindingFlags.Static);
    if (driver is null && property is not null && property.GetIndexParameters().Length == 0) driver = property.GetValue(null);
    if (driver is null) throw new InvalidOperationException($"runtime driver not found: {request.DriverExport}");
    var driverArguments = GenericArguments(driver.GetType(), typeof(ScenarioDriver<,,,>), "runtime driver");
    if (!driverArguments.Skip(1).SequenceEqual(suiteArguments)) throw new InvalidOperationException("runtime suite and driver generic types do not agree");

    var method = typeof(TypedExecutor).GetMethod(nameof(TypedExecutor.Execute), BindingFlags.Public | BindingFlags.Static)!
        .MakeGenericMethod(driverArguments);
    var task = (Task<IReadOnlyList<Result>>)method.Invoke(null, [suite, driver, request.Selected, cancellation.Token])!;
    var results = await task;
    var report = JsonSerializer.SerializeToUtf8Bytes(new Report(1, results), json);
    if (report.Length > TransportLimit) throw new InvalidOperationException(".NET execution report exceeds 4000000 bytes");
    await using var output = new FileStream(args[1], FileMode.CreateNew, FileAccess.Write, FileShare.None);
    await output.WriteAsync(report);
    await output.FlushAsync();
}
finally
{
    cancellation.Cancel();
    await cancellationWatch;
}


static void ValidateBinding(object suite, string path, string exportName)
{
    var property = suite.GetType().GetProperty("Driver", BindingFlags.Public | BindingFlags.Instance)
        ?? throw new InvalidOperationException("runtime suite has no driver binding property");
    var binding = property.GetValue(suite) ?? throw new InvalidOperationException("runtime suite driver binding is missing");
    var bindingPath = binding.GetType().GetProperty("Path")?.GetValue(binding) as string;
    var bindingExport = binding.GetType().GetProperty("Export")?.GetValue(binding) as string;
    if (!string.Equals(bindingPath, path, StringComparison.Ordinal) || !string.Equals(bindingExport, exportName, StringComparison.Ordinal))
        throw new InvalidOperationException("runtime driver binding changed after resolution");
}

static void ValidateInventory(object suite, IReadOnlyList<Identity> inventory)
{
    var scenarios = suite.GetType().GetProperty("Scenarios")?.GetValue(suite) as IEnumerable
        ?? throw new InvalidOperationException("runtime suite inventory is unavailable");
    var actual = new List<Identity>();
    foreach (var scenario in scenarios)
    {
        if (scenario is null) throw new InvalidOperationException("runtime suite contains null");
        var id = scenario.GetType().GetProperty("Id")?.GetValue(scenario) as string;
        var name = scenario.GetType().GetProperty("Name")?.GetValue(scenario) as string;
        if (id is null || name is null) throw new InvalidOperationException("runtime scenario identity is invalid");
        actual.Add(new Identity(id, name));
    }
    if (!actual.SequenceEqual(inventory)) throw new InvalidOperationException("runtime scenario inventory changed after resolution");
}

static Type FindType(string typeName)
{
    var matches = new List<Type>();
    foreach (var path in Directory.EnumerateFiles(AppContext.BaseDirectory, "*.dll"))
    {
        try
        {
            var assembly = AssemblyLoadContext.Default.Assemblies.FirstOrDefault(value => string.Equals(value.Location, path, StringComparison.OrdinalIgnoreCase))
                ?? AssemblyLoadContext.Default.LoadFromAssemblyPath(path);
            var type = assembly.GetType(typeName, throwOnError: false, ignoreCase: false);
            if (type is not null) matches.Add(type);
        }
        catch (BadImageFormatException) { }
        catch (FileLoadException) { }
        catch (FileNotFoundException) { }
    }
    if (matches.Count != 1) throw new InvalidOperationException($"expected one runtime type: {typeName}");
    return matches[0];
}

static Type[] GenericArguments(Type value, Type definition, string label)
{
    if (!value.IsGenericType || value.GetGenericTypeDefinition() != definition) throw new InvalidOperationException($"{label} has an unexpected type");
    return value.GetGenericArguments();
}

static async Task<string> ReadBoundedAsync(string path)
{
    await using var input = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read);
    if (input.Length > TransportLimit) throw new InvalidOperationException(".NET bridge request exceeds 4000000 bytes");
    using var output = new MemoryStream();
    await input.CopyToAsync(output);
    return new UTF8Encoding(false, true).GetString(output.ToArray());
}

static async Task WatchCancellationAsync(string path, CancellationTokenSource cancellation)
{
    while (!cancellation.IsCancellationRequested)
    {
        if (File.Exists(path))
        {
            cancellation.Cancel();
            return;
        }
        try { await Task.Delay(20, cancellation.Token); }
        catch (OperationCanceledException) { return; }
    }
}

sealed record Request(int Protocol, string SuiteType, string SuiteMember, string DriverPath, string DriverExport, IReadOnlyList<Identity> Inventory, IReadOnlyList<Identity> Selected);
sealed record Identity(string Id, string Name);
sealed record PortableEvent(string Kind, string Message, object? Data = null);
sealed record Result(string Id, string Status, string? Diagnostic, IReadOnlyList<PortableEvent> Events);
sealed record Report(int Protocol, IReadOnlyList<Result> Results);

static class TypedExecutor
{
    public static async Task<IReadOnlyList<Result>> Execute<TSubject, TGiven, TWhen, TExpect>(
        object suiteValue,
        object driverValue,
        IReadOnlyList<Identity> selected,
        CancellationToken cancellationToken)
    {
        var suite = (ScenarioSuite<TGiven, TWhen, TExpect>)suiteValue;
        var driver = (ScenarioDriver<TSubject, TGiven, TWhen, TExpect>)driverValue;
        ScenarioValidation.Validate(suite);
        var scenarios = suite.Scenarios.ToDictionary(value => value.Id, StringComparer.Ordinal);
        var results = new List<Result>(selected.Count);
        var seen = new HashSet<string>(StringComparer.Ordinal);
        foreach (var identity in selected)
        {
            if (!seen.Add(identity.Id)) throw new InvalidOperationException($"duplicate selected scenario: {identity.Id}");
            if (!scenarios.TryGetValue(identity.Id, out var scenario) || !string.Equals(scenario.Name, identity.Name, StringComparison.Ordinal))
                throw new InvalidOperationException($"runtime selected scenario identity changed: {identity.Id}");
            var events = new EventCollector();
            try
            {
                cancellationToken.ThrowIfCancellationRequested();
                await ScenarioExecutor.VerifyAsync(driver, scenario, cancellationToken, events.Emit);
                results.Add(new Result(identity.Id, "pass", null, events.Events));
            }
            catch (Exception error)
            {
                var text = error.ToString();
                var diagnostic = text.Length <= 8_000 ? text : text[^8_000..];
                results.Add(new Result(identity.Id, "fail", diagnostic, events.Events));
            }
        }
        return results;
    }
}

sealed class EventCollector
{
    private const int EventLimit = 256;
    private const int ByteLimit = 65_536;
    private static readonly PortableEvent Truncated = new("truncated", "Additional execution events omitted");
    private readonly List<PortableEvent> _events = [];
    private int _bytes = 2;
    private bool _stopped;

    public IReadOnlyList<PortableEvent> Events => _events;

    public void Emit(ExecutionEvent value)
    {
        if (_stopped) return;
        var message = value.Kind == "observation" ? value.Name : value.Message;
        if (message is not null && Encoding.UTF8.GetByteCount(message) > ByteLimit) throw new InvalidOperationException("cannot project .NET execution event: message exceeds 65536 bytes");
        PortableEvent projected;
        try
        {
            projected = value.Kind switch
            {
                "observation" when !string.IsNullOrWhiteSpace(value.Name) => new(value.Kind, value.Name, new Dictionary<string, object?> { ["value"] = Projector.Project(value.Value) }),
                "explanation" when !string.IsNullOrWhiteSpace(value.Message) => new(value.Kind, value.Message, value.Data is null ? null : Projector.Project(value.Data)),
                _ => throw new InvalidOperationException($"unsupported SDK event: {value.Kind}"),
            };
        }
        catch (Exception error)
        {
            throw new InvalidOperationException($"cannot project .NET execution event: {error.Message}", error);
        }
        var size = JsonSerializer.SerializeToUtf8Bytes(projected).Length + (_events.Count == 0 ? 0 : 1);
        var markerSize = JsonSerializer.SerializeToUtf8Bytes(Truncated).Length + 1;
        if (_events.Count >= EventLimit - 1 || _bytes + size + markerSize > ByteLimit)
        {
            _events.Add(Truncated);
            _stopped = true;
            return;
        }
        _events.Add(projected);
        _bytes += size;
    }
}

static class Projector
{
    private const long SafeInteger = 9_007_199_254_740_991;
    private const int DepthLimit = 20;
    private const int ItemLimit = 4096;
    private const int StringByteLimit = 65_536;

    public static object? Project(object? value) => Project(value, 0, new HashSet<object>(ReferenceEqualityComparer.Instance), new Counter());

    private static object? Project(object? value, int depth, HashSet<object> seen, Counter counter)
    {
        if (++counter.Value > ItemLimit) throw new InvalidOperationException("event value contains too many items");
        if (depth > DepthLimit) throw new InvalidOperationException("event value is too deeply nested");
        if (value is null or bool) return value;
        if (value is string text)
        {
            if (Encoding.UTF8.GetByteCount(text) > StringByteLimit) throw new InvalidOperationException("event string exceeds 65536 bytes");
            return text;
        }
        var type = value.GetType();
        if (type.IsEnum) return new Dictionary<string, object?> { ["clrType"] = type.FullName ?? type.Name, ["value"] = value.ToString() };
        if (value is byte or sbyte or short or ushort or int or uint) return value;
        if (value is long signed) return Math.Abs((decimal)signed) <= SafeInteger ? signed : TypedNumber(type, signed.ToString(CultureInfo.InvariantCulture));
        if (value is ulong unsigned) return unsigned <= SafeInteger ? unsigned : TypedNumber(type, unsigned.ToString(CultureInfo.InvariantCulture));
        if (value is float single)
        {
            if (!float.IsFinite(single)) throw new InvalidOperationException("event value contains a non-finite number");
            return single;
        }
        if (value is double number)
        {
            if (!double.IsFinite(number)) throw new InvalidOperationException("event value contains a non-finite number");
            return number;
        }
        if (value is decimal precise) return TypedNumber(type, precise.ToString(CultureInfo.InvariantCulture));
        if (value is char character) return TypedNumber(type, character.ToString());
        if (value is DateTime or DateTimeOffset or Guid or TimeSpan)
            return new Dictionary<string, object?> { ["clrType"] = type.FullName ?? type.Name, ["value"] = Convert.ToString(value, CultureInfo.InvariantCulture) };
        var tracked = !type.IsValueType;
        if (tracked && !seen.Add(value)) throw new InvalidOperationException("event value contains a cycle");
        try
        {
            if (value is IDictionary dictionary)
            {
                var result = new Dictionary<string, object?>(StringComparer.Ordinal);
                foreach (DictionaryEntry entry in dictionary)
                {
                    if (result.Count >= ItemLimit) throw new InvalidOperationException("event dictionary contains too many items");
                    if (entry.Key is not string key || !result.TryAdd(key, Project(entry.Value, depth + 1, seen, counter)))
                        throw new InvalidOperationException("event dictionaries require unique string keys");
                }
                return result;
            }
            if (value is IEnumerable sequence)
            {
                var result = new List<object?>();
                foreach (var item in sequence)
                {
                    if (result.Count >= ItemLimit) throw new InvalidOperationException("event sequence contains too many items");
                    result.Add(Project(item, depth + 1, seen, counter));
                }
                return result;
            }
            if (value is Delegate or Stream or Task or Type or MemberInfo) throw new InvalidOperationException($"unsupported event value type: {type.FullName}");
            var properties = type.GetProperties(BindingFlags.Instance | BindingFlags.Public)
                .Where(property => property.CanRead && property.GetIndexParameters().Length == 0)
                .OrderBy(property => property.MetadataToken)
                .ToArray();
            var fields = type.GetFields(BindingFlags.Instance | BindingFlags.Public).OrderBy(field => field.MetadataToken).ToArray();
            if (properties.Length == 0 && fields.Length == 0) throw new InvalidOperationException($"unsupported event value type: {type.FullName}");
            var projected = new Dictionary<string, object?>(StringComparer.Ordinal);
            foreach (var property in properties)
                if (!projected.TryAdd(property.Name, Project(property.GetValue(value), depth + 1, seen, counter))) throw new InvalidOperationException("duplicate projected event field");
            foreach (var field in fields)
                if (!projected.TryAdd(field.Name, Project(field.GetValue(value), depth + 1, seen, counter))) throw new InvalidOperationException("duplicate projected event field");
            return projected;
        }
        finally
        {
            if (tracked) seen.Remove(value);
        }
    }

    private static object TypedNumber(Type type, string value) => new Dictionary<string, object?> { ["clrType"] = type.FullName ?? type.Name, ["value"] = value };
    private sealed class Counter { public int Value; }
}
