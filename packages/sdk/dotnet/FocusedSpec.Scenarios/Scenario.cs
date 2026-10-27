using System.Collections;
using System.Reflection;
using System.Runtime.CompilerServices;

namespace FocusedSpec.Scenarios;

public sealed class Scenario<TGiven, TWhen, TExpect>
{
    public Scenario(string id, string name, TGiven given, TWhen when, TExpect expect)
    {
        Id = id;
        Name = name;
        Given = given;
        When = when;
        Expect = expect;
    }

    public string Id { get; }
    public string Name { get; }
    public TGiven Given { get; }
    public TWhen When { get; }
    public TExpect Expect { get; }
}

public sealed record ScenarioDriverBinding(string Path, string Export);

public sealed class ScenarioSuite<TGiven, TWhen, TExpect>
{
    public ScenarioSuite(IEnumerable<Scenario<TGiven, TWhen, TExpect>> scenarios, ScenarioDriverBinding? driver = null)
    {
        Scenarios = scenarios?.ToArray() ?? throw new ArgumentNullException(nameof(scenarios));
        Driver = driver;
    }

    public IReadOnlyList<Scenario<TGiven, TWhen, TExpect>> Scenarios { get; }
    public ScenarioDriverBinding? Driver { get; }
}

public sealed class DriverContext
{
    private readonly Action<ExecutionEvent>? _observer;

    internal DriverContext(string scenarioId, CancellationToken cancellationToken, Action<ExecutionEvent>? observer)
    {
        ScenarioId = scenarioId;
        CancellationToken = cancellationToken;
        _observer = observer;
    }

    public string ScenarioId { get; }
    public CancellationToken CancellationToken { get; }

    public void Explain(string message, object? data = null)
    {
        if (string.IsNullOrWhiteSpace(message)) throw new ArgumentException("Explanation message must be nonblank.", nameof(message));
        if (_observer is not null)
        {
            ScenarioValidation.ValidateData(data, "explanation data");
            _observer(new ExecutionEvent("explanation", Message: message, Data: data is null ? null : ScenarioValidation.Clone(data)));
        }
    }
}

public sealed class ScenarioDriver<TSubject, TGiven, TWhen, TExpect>
{
    public required Func<TGiven, DriverContext, ValueTask<TSubject>> Given { get; init; }
    public required Func<TSubject, TWhen, DriverContext, ValueTask<TExpect>> When { get; init; }
    public Func<TSubject, DriverContext, ValueTask>? Cleanup { get; init; }
}

public sealed record ExecutionEvent(string Kind, string? Name = null, object? Value = null, string? Message = null, object? Data = null);

public sealed class ScenarioMismatchException : Exception
{
    public ScenarioMismatchException(string scenarioId, string scenarioName, object? expected, object? actual)
        : base($"{scenarioId}: {scenarioName}: expected {expected}, actual {actual}")
    {
        ScenarioId = scenarioId;
        ScenarioName = scenarioName;
        Expected = expected;
        Actual = actual;
    }

    public string ScenarioId { get; }
    public string ScenarioName { get; }
    public object? Expected { get; }
    public object? Actual { get; }
}

public static class ScenarioValidation
{
    public static void Validate<TGiven, TWhen, TExpect>(Scenario<TGiven, TWhen, TExpect> scenario)
    {
        ArgumentNullException.ThrowIfNull(scenario);
        if (!ValidId(scenario.Id)) throw new ArgumentException("Scenario ID must contain non-whitespace and no control characters.", nameof(scenario));
        if (string.IsNullOrWhiteSpace(scenario.Name)) throw new ArgumentException("Scenario name must be nonblank.", nameof(scenario));
        ValidateData(scenario.Given, "Given");
        ValidateData(scenario.When, "When");
        ValidateData(scenario.Expect, "Expect");
    }

    public static void Validate<TGiven, TWhen, TExpect>(ScenarioSuite<TGiven, TWhen, TExpect> suite)
    {
        ArgumentNullException.ThrowIfNull(suite);
        if (suite.Scenarios.Count == 0) throw new ArgumentException("Suite must contain at least one scenario.", nameof(suite));
        var ids = new HashSet<string>(StringComparer.Ordinal);
        foreach (var scenario in suite.Scenarios)
        {
            Validate(scenario);
            if (!ids.Add(scenario.Id)) throw new ArgumentException($"Duplicate scenario ID: {scenario.Id}", nameof(suite));
        }
    }

    internal static bool ValidId(string? id) => !string.IsNullOrWhiteSpace(id) && !id.Any(char.IsControl);

    internal static void ValidateData(object? value, string label)
    {
        Visit(value, label, new HashSet<object>(ReferenceComparer.Instance));
    }

    private static void Visit(object? value, string label, HashSet<object> ancestors)
    {
        if (value is null) return;
        var type = value.GetType();
        if (type.IsEnum || value is string || value is bool || value is char || value is decimal || value is DateTime || value is DateTimeOffset || value is TimeSpan || value is Guid) return;
        if (type.IsPrimitive)
        {
            if (value is double d && (double.IsNaN(d) || double.IsInfinity(d))) throw new ArgumentException($"{label} contains a non-finite number.");
            if (value is float f && (float.IsNaN(f) || float.IsInfinity(f))) throw new ArgumentException($"{label} contains a non-finite number.");
            return;
        }
        if (value is Delegate or Stream or Task or Type or IntPtr or UIntPtr)
            throw new ArgumentException($"{label} contains unsupported {type}.");
        if (!type.IsValueType && !ancestors.Add(value)) throw new ArgumentException($"{label} contains a cycle.");
        try
        {
            if (value is IDictionary dictionary)
            {
                foreach (DictionaryEntry entry in dictionary)
                {
                    Visit(entry.Key, $"{label}.key", ancestors);
                    Visit(entry.Value, $"{label}[{entry.Key}]", ancestors);
                }
                return;
            }
            if (value is IEnumerable sequence)
            {
                var index = 0;
                foreach (var item in sequence) Visit(item, $"{label}[{index++}]", ancestors);
                return;
            }
            foreach (var field in DataFields(type)) Visit(field.GetValue(value), $"{label}.{field.Name}", ancestors);
        }
        finally
        {
            if (!type.IsValueType) ancestors.Remove(value);
        }
    }

    internal static object? Clone(object? value)
    {
        return Clone(value, new Dictionary<object, object>(ReferenceComparer.Instance));
    }

    private static readonly MethodInfo ShallowCloneMethod = typeof(object).GetMethod("MemberwiseClone", BindingFlags.Instance | BindingFlags.NonPublic)!;

    private static object? Clone(object? value, Dictionary<object, object> copies)
    {
        if (value is null) return null;
        var type = value.GetType();
        if (type.IsPrimitive || type.IsEnum || value is string or decimal or DateTime or DateTimeOffset or TimeSpan or Guid) return value;
        if (copies.TryGetValue(value, out var known)) return known;
        if (value is Array array)
        {
            var clone = (Array)array.Clone();
            copies.Add(value, clone);
            var indices = new int[array.Rank];
            void CopyDimension(int dimension)
            {
                for (var index = array.GetLowerBound(dimension); index <= array.GetUpperBound(dimension); index++)
                {
                    indices[dimension] = index;
                    if (dimension + 1 < array.Rank) CopyDimension(dimension + 1);
                    else clone.SetValue(Clone(array.GetValue(indices), copies), indices);
                }
            }
            CopyDimension(0);
            return clone;
        }
        var result = ShallowCloneMethod.Invoke(value, null)!;
        copies.Add(value, result);
        foreach (var field in DataFields(type)) field.SetValue(result, Clone(field.GetValue(value), copies));
        return result;
    }

    internal static IEnumerable<FieldInfo> DataFields(Type type)
    {
        for (var current = type; current is not null; current = current.BaseType)
            foreach (var field in current.GetFields(BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.DeclaredOnly))
                yield return field;
    }

    private sealed class ReferenceComparer : IEqualityComparer<object>
    {
        public static ReferenceComparer Instance { get; } = new();
        public new bool Equals(object? x, object? y) => ReferenceEquals(x, y);
        public int GetHashCode(object obj) => RuntimeHelpers.GetHashCode(obj);
    }
}

