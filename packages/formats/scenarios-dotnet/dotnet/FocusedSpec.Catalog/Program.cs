using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Diagnostics.CodeAnalysis;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;

var json = new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase, PropertyNameCaseInsensitive = true };
try
{
    var input = await ReadInputAsync();
    var request = JsonSerializer.Deserialize<Request>(input, json) ?? throw new SourceException("invalid parser request", 1);
    object value = request.Kind switch
    {
        "catalog" => new { ok = true, catalog = Analyzer.ReadCatalog(request.Path, request.Source) },
        "driver" when !string.IsNullOrEmpty(request.Export) => new { ok = true, driver = Analyzer.ReadDriver(request.Path, request.Source, request.Export) },
        _ => throw new SourceException("invalid parser request", 1),
    };
    await Console.Out.WriteAsync(JsonSerializer.Serialize(value, json));
}
catch (Exception error)
{
    var source = error as SourceException;
    await Console.Out.WriteAsync(JsonSerializer.Serialize(new
    {
        ok = false,
        error = source?.Message ?? error.Message,
        line = source?.Line ?? 1,
    }, json));
}

static async Task<string> ReadInputAsync()
{
    await using var input = Console.OpenStandardInput();
    using var output = new MemoryStream();
    var buffer = new byte[81920];
    while (true)
    {
        var count = await input.ReadAsync(buffer);
        if (count == 0) break;
        if (output.Length + count > Analyzer.InputLimit) throw new SourceException("parser input exceeds 4000000 bytes", 1);
        output.Write(buffer, 0, count);
    }
    return new UTF8Encoding(false, true).GetString(output.ToArray());
}

sealed record Request(
    [property: JsonPropertyName("kind")] string Kind,
    [property: JsonPropertyName("path")] string Path,
    [property: JsonPropertyName("source")] string Source,
    [property: JsonPropertyName("export")] string? Export);

sealed record CatalogDriverBinding(string Path, string ExportName);
sealed record CatalogSuite(string NamespaceName, string TypeName, string ExportName, CatalogDriverBinding Driver);
sealed record CatalogScenario(string Id, string Name, int Line);
sealed record Catalog(CatalogSuite Suite, IReadOnlyList<CatalogScenario> Scenarios);
sealed record DriverCatalog(string TypeName, string ExportName);

sealed class SourceException(string message, int line) : Exception(message)
{
    public int Line { get; } = Math.Max(1, line);
}

static class Analyzer
{
    internal const int InputLimit = 4_000_000;

    public static Catalog ReadCatalog(string path, string source)
    {
        var root = Parse(path, source);
        RejectConditionals(root);
        var candidates = root.DescendantNodes().OfType<FieldDeclarationSyntax>()
            .Where(field => IsScenarioSuite(field.Declaration.Type) && PublicStatic(field.Modifiers))
            .ToArray();
        if (candidates.Length != 1) Fail(root, "expected exactly one public static ScenarioSuite field");
        var field = candidates[0];
        if (field.Declaration.Variables.Count != 1) Fail(field, "scenario suite field must declare exactly one value");
        var variable = field.Declaration.Variables[0];
        if (variable.Initializer is null) Fail(variable, "scenario suite field requires a literal initializer");
        var owner = field.Ancestors().OfType<ClassDeclarationSyntax>().FirstOrDefault();
        if (owner is null || !PublicStatic(owner.Modifiers) || owner.TypeParameterList is not null || owner.Ancestors().OfType<ClassDeclarationSyntax>().Any() || string.IsNullOrWhiteSpace(owner.Identifier.ValueText))
            Fail(field, "scenario suite must be inside a named non-generic public static class");
        var namespaceName = NamespaceName(owner);
        if (string.IsNullOrEmpty(namespaceName)) Fail(owner, "scenario suite requires a named namespace");
        var suite = Unwrap(variable.Initializer.Value);
        if (suite is not ObjectCreationExpressionSyntax and not ImplicitObjectCreationExpressionSyntax)
            Fail(suite, "scenario suite must use a literal constructor");
        if (suite is ObjectCreationExpressionSyntax explicitSuite && !IsScenarioSuite(explicitSuite.Type))
            Fail(explicitSuite.Type, "scenario suite initializer type does not match ScenarioSuite");
        if (Initializer(suite) is not null) Fail(suite, "scenario suite constructor does not accept an object initializer");
        var arguments = Arguments(suite);
        var mapped = MapArguments(arguments, ["scenarios", "driver"], suite, "scenario suite");
        var driver = ReadBinding(mapped["driver"]);
        var scenarios = ReadScenarios(mapped["scenarios"]);
        var ids = new HashSet<string>(StringComparer.Ordinal);
        foreach (var scenario in scenarios)
            if (!ids.Add(scenario.Id)) throw new SourceException($"duplicate scenario ID: {scenario.Id}", scenario.Line);
        return new Catalog(
            new CatalogSuite(namespaceName, $"{namespaceName}.{owner.Identifier.ValueText}", variable.Identifier.ValueText, driver),
            scenarios);
    }

    public static DriverCatalog ReadDriver(string path, string source, string exportName)
    {
        var root = Parse(path, source);
        RejectConditionals(root);
        var separator = exportName.LastIndexOf('.');
        if (separator <= 0 || separator == exportName.Length - 1) Fail(root, "driver export must be a fully qualified static member");
        var typeName = exportName[..separator];
        var memberName = exportName[(separator + 1)..];
        var matches = new List<MemberDeclarationSyntax>();
        foreach (var member in root.DescendantNodes().OfType<MemberDeclarationSyntax>())
        {
            if (member is FieldDeclarationSyntax field && PublicStatic(field.Modifiers) && IsScenarioDriver(field.Declaration.Type)
                && field.Declaration.Variables.Count == 1 && field.Declaration.Variables[0].Identifier.ValueText == memberName
                && OwnerName(field) == typeName) matches.Add(field);
            if (member is PropertyDeclarationSyntax property && PublicStatic(property.Modifiers) && IsScenarioDriver(property.Type)
                && property.Identifier.ValueText == memberName && OwnerName(property) == typeName
                && (property.ExpressionBody is not null || property.AccessorList?.Accessors.Any(accessor => accessor.IsKind(SyntaxKind.GetAccessorDeclaration)) == true)) matches.Add(property);
        }
        if (matches.Count != 1) Fail(root, $"expected one public static ScenarioDriver field or parameterless property: {exportName}");
        return new DriverCatalog(typeName, memberName);
    }

    private static CompilationUnitSyntax Parse(string path, string source)
    {
        if (Encoding.UTF8.GetByteCount(source) > InputLimit) throw new SourceException("C# source exceeds 4000000 bytes", 1);
        var tree = CSharpSyntaxTree.ParseText(source, new CSharpParseOptions(LanguageVersion.CSharp13), path);
        var root = tree.GetCompilationUnitRoot();
        var diagnostic = tree.GetDiagnostics().FirstOrDefault(item => item.Severity == DiagnosticSeverity.Error);
        if (diagnostic is not null)
        {
            var line = diagnostic.Location.GetLineSpan().StartLinePosition.Line + 1;
            throw new SourceException(diagnostic.GetMessage(), line);
        }
        return root;
    }

    private static void RejectConditionals(CompilationUnitSyntax root)
    {
        var conditional = root.DescendantTrivia(descendIntoTrivia: true).FirstOrDefault(trivia =>
            trivia.IsKind(SyntaxKind.IfDirectiveTrivia) || trivia.IsKind(SyntaxKind.ElifDirectiveTrivia)
            || trivia.IsKind(SyntaxKind.ElseDirectiveTrivia) || trivia.IsKind(SyntaxKind.EndIfDirectiveTrivia));
        if (conditional != default) Fail(conditional.GetStructure() ?? root, "conditional directives are not supported in scenario or driver sources");
    }

    private static CatalogDriverBinding ReadBinding(ExpressionSyntax expression)
    {
        expression = Unwrap(expression);
        if (expression is not ObjectCreationExpressionSyntax and not ImplicitObjectCreationExpressionSyntax)
            Fail(expression, "driver binding must use a literal ScenarioDriverBinding constructor");
        if (expression is ObjectCreationExpressionSyntax explicitBinding && !NamedType(explicitBinding.Type, "ScenarioDriverBinding", 0))
            Fail(explicitBinding.Type, "driver binding must construct ScenarioDriverBinding");
        if (Initializer(expression) is not null) Fail(expression, "driver binding does not accept an object initializer");
        var arguments = Arguments(expression);
        if (arguments.Count != 2) Fail(expression, "driver binding requires Path and Export");
        var mapped = MapArguments(arguments, ["Path", "Export"], expression, "driver binding");
        var path = StringLiteral(mapped["Path"], "driver Path");
        var exportName = StringLiteral(mapped["Export"], "driver Export");
        var driveAbsolute = path.Length >= 3 && char.IsAsciiLetter(path[0]) && path[1] == ':' && path[2] == '/';
        if (string.IsNullOrWhiteSpace(path) || path.Contains('\\') || Path.IsPathRooted(path) || driveAbsolute || path.Any(char.IsControl))
            Fail(mapped["Path"], "driver Path must be a relative control-free C# source path");
        if (!path.EndsWith(".cs", StringComparison.OrdinalIgnoreCase)) Fail(mapped["Path"], "driver Path must name a C# source file");
        if (!QualifiedIdentifier(exportName)) Fail(mapped["Export"], "driver Export must name a fully qualified public static member");
        return new CatalogDriverBinding(path, exportName);
    }

    private static IReadOnlyList<CatalogScenario> ReadScenarios(ExpressionSyntax expression)
    {
        var values = CollectionValues(expression, "scenarios");
        if (values.Count == 0) Fail(expression, "scenario suite must contain at least one scenario");
        return values.Select(ReadScenario).ToArray();
    }

    private static CatalogScenario ReadScenario(ExpressionSyntax expression)
    {
        expression = Unwrap(expression);
        if (expression is not ObjectCreationExpressionSyntax and not ImplicitObjectCreationExpressionSyntax)
            Fail(expression, "scenario must use a literal Scenario constructor");
        if (expression is ObjectCreationExpressionSyntax explicitScenario && !IsScenario(explicitScenario.Type))
            Fail(explicitScenario.Type, "scenario initializer type does not match Scenario");
        if (Initializer(expression) is not null) Fail(expression, "scenario constructor does not accept an object initializer");
        var arguments = Arguments(expression);
        if (arguments.Count != 5) Fail(expression, "scenario requires Id, Name, Given, When, and Expect");
        var mapped = MapArguments(arguments, ["id", "name", "given", "when", "expect"], expression, "scenario");
        var id = StringLiteral(mapped["id"], "scenario ID");
        var name = StringLiteral(mapped["name"], "scenario name");
        if (string.IsNullOrWhiteSpace(id) || id.Any(char.IsControl)) Fail(mapped["id"], "scenario ID must contain non-whitespace and no control characters");
        if (string.IsNullOrWhiteSpace(name)) Fail(mapped["name"], "scenario name must be nonblank");
        ValidateData(mapped["given"]);
        ValidateData(mapped["when"]);
        ValidateData(mapped["expect"]);
        return new CatalogScenario(id, name, Line(expression));
    }

    private static void ValidateData(ExpressionSyntax expression)
    {
        expression = Unwrap(expression);
        if (expression is LiteralExpressionSyntax literal)
        {
            if (literal.IsKind(SyntaxKind.NullLiteralExpression) || literal.IsKind(SyntaxKind.TrueLiteralExpression)
                || literal.IsKind(SyntaxKind.FalseLiteralExpression) || literal.IsKind(SyntaxKind.StringLiteralExpression)) return;
            if (FiniteNumericLiteral(literal)) return;
            Fail(expression, "unsupported or non-finite scenario data literal");
        }
        if (expression is PrefixUnaryExpressionSyntax unary && unary.IsKind(SyntaxKind.UnaryMinusExpression)
            && Unwrap(unary.Operand) is LiteralExpressionSyntax number && FiniteNumericLiteral(number)) return;
        if (expression is CollectionExpressionSyntax collection)
        {
            foreach (var element in collection.Elements)
            {
                if (element is ExpressionElementSyntax value) ValidateData(value.Expression);
                else Fail(element, "spreads are not supported in scenario data");
            }
            return;
        }
        if (expression is ArrayCreationExpressionSyntax array)
        {
            if (array.Initializer is null) Fail(array, "array data requires a literal initializer");
            ValidateInitializer(array.Initializer);
            return;
        }
        if (expression is ImplicitArrayCreationExpressionSyntax implicitArray)
        {
            ValidateInitializer(implicitArray.Initializer);
            return;
        }
        if (expression is ObjectCreationExpressionSyntax or ImplicitObjectCreationExpressionSyntax)
        {
            foreach (var argument in Arguments(expression))
            {
                if (argument.RefKindKeyword.Kind() != SyntaxKind.None) Fail(argument, "ref, out, and in data arguments are not supported");
                ValidateData(argument.Expression);
            }
            if (Initializer(expression) is { } initializer) ValidateInitializer(initializer);
            return;
        }
        Fail(expression, "scenario data must be recursively literal");
    }

    private static void ValidateInitializer(InitializerExpressionSyntax initializer)
    {
        var names = new HashSet<string>(StringComparer.Ordinal);
        var keys = new HashSet<string>(StringComparer.Ordinal);
        foreach (var item in initializer.Expressions)
        {
            if (item is AssignmentExpressionSyntax assignment)
            {
                if (assignment.Left is ImplicitElementAccessSyntax access)
                {
                    if (access.ArgumentList.Arguments.Count != 1 || access.ArgumentList.Arguments[0].RefKindKeyword.Kind() != SyntaxKind.None)
                        Fail(access, "dictionary entries require one string key");
                    var key = StringLiteral(access.ArgumentList.Arguments[0].Expression, "dictionary key");
                    if (!keys.Add(key)) Fail(access, $"duplicate dictionary key: {key}");
                    ValidateData(assignment.Right);
                    continue;
                }
                var name = assignment.Left switch
                {
                    IdentifierNameSyntax identifier => identifier.Identifier.ValueText,
                    MemberAccessExpressionSyntax member => member.Name.Identifier.ValueText,
                    _ => null,
                };
                if (name is null) Fail(assignment.Left, "object initializer fields must be named directly");
                if (!names.Add(name)) Fail(assignment.Left, $"duplicate object initializer field: {name}");
                ValidateData(assignment.Right);
            }
            else if (item is InitializerExpressionSyntax nested && nested.IsKind(SyntaxKind.ComplexElementInitializerExpression))
            {
                if (nested.Expressions.Count != 2) Fail(nested, "dictionary entries require one string key and one value");
                var key = StringLiteral(nested.Expressions[0], "dictionary key");
                if (!keys.Add(key)) Fail(nested.Expressions[0], $"duplicate dictionary key: {key}");
                ValidateData(nested.Expressions[1]);
            }
            else ValidateData(item);
        }
    }

    private static IReadOnlyList<ExpressionSyntax> CollectionValues(ExpressionSyntax expression, string label)
    {
        expression = Unwrap(expression);
        if (expression is CollectionExpressionSyntax collection)
        {
            var result = new List<ExpressionSyntax>();
            foreach (var element in collection.Elements)
            {
                if (element is ExpressionElementSyntax value) result.Add(value.Expression);
                else Fail(element, $"{label} cannot contain spreads");
            }
            return result;
        }
        var initializer = expression switch
        {
            ArrayCreationExpressionSyntax array => array.Initializer,
            ImplicitArrayCreationExpressionSyntax implicitArray => implicitArray.Initializer,
            ObjectCreationExpressionSyntax creation => creation.Initializer,
            ImplicitObjectCreationExpressionSyntax creation => creation.Initializer,
            _ => null,
        };
        if (initializer is null) Fail(expression, $"{label} must be a literal collection or array initializer");
        return initializer.Expressions.ToArray();
    }

    private static Dictionary<string, ExpressionSyntax> MapArguments(SeparatedSyntaxList<ArgumentSyntax> arguments, IReadOnlyList<string> names, SyntaxNode owner, string label)
    {
        var mapped = new Dictionary<string, ExpressionSyntax>(StringComparer.Ordinal);
        var namedSeen = false;
        for (var index = 0; index < arguments.Count; index++)
        {
            var argument = arguments[index];
            if (argument.RefKindKeyword.Kind() != SyntaxKind.None) Fail(argument, $"{label} does not support ref, out, or in arguments");
            string name;
            if (argument.NameColon is null)
            {
                if (namedSeen || index >= names.Count) Fail(argument, $"invalid positional {label} argument");
                name = names[index];
            }
            else
            {
                namedSeen = true;
                name = argument.NameColon.Name.Identifier.ValueText;
                var canonical = names.FirstOrDefault(value => string.Equals(value, name, StringComparison.Ordinal));
                if (canonical is null) Fail(argument, $"unknown {label} field: {name}");
                name = canonical;
            }
            if (!mapped.TryAdd(name, argument.Expression)) Fail(argument, $"duplicate {label} field: {name}");
        }
        foreach (var name in names) if (!mapped.ContainsKey(name)) Fail(owner, $"{label} requires {name}");
        return mapped;
    }

    private static SeparatedSyntaxList<ArgumentSyntax> Arguments(ExpressionSyntax expression) => expression switch
    {
        ObjectCreationExpressionSyntax value => value.ArgumentList?.Arguments ?? default,
        ImplicitObjectCreationExpressionSyntax value => value.ArgumentList.Arguments,
        _ => default,
    };

    private static InitializerExpressionSyntax? Initializer(ExpressionSyntax expression) => expression switch
    {
        ObjectCreationExpressionSyntax value => value.Initializer,
        ImplicitObjectCreationExpressionSyntax value => value.Initializer,
        _ => null,
    };

    private static string StringLiteral(ExpressionSyntax expression, string label)
    {
        expression = Unwrap(expression);
        if (expression is not LiteralExpressionSyntax || !expression.IsKind(SyntaxKind.StringLiteralExpression))
            Fail(expression, $"{label} must be a string literal");
        return (string)((LiteralExpressionSyntax)expression).Token.Value!;
    }

    private static ExpressionSyntax Unwrap(ExpressionSyntax expression)
    {
        while (expression is ParenthesizedExpressionSyntax parenthesized) expression = parenthesized.Expression;
        return expression;
    }

    private static bool FiniteNumericLiteral(LiteralExpressionSyntax literal)
    {
        if (!literal.IsKind(SyntaxKind.NumericLiteralExpression)) return false;
        return literal.Token.Value switch
        {
            float value => float.IsFinite(value),
            double value => double.IsFinite(value),
            _ => true,
        };
    }

    private static bool IsScenarioSuite(TypeSyntax type) => NamedType(type, "ScenarioSuite", 3);
    private static bool IsScenario(TypeSyntax type) => NamedType(type, "Scenario", 3);
    private static bool IsScenarioDriver(TypeSyntax type) => NamedType(type, "ScenarioDriver", 4);

    private static bool NamedType(TypeSyntax type, string name, int arity)
    {
        var simple = type switch
        {
            GenericNameSyntax generic => generic,
            QualifiedNameSyntax qualified => qualified.Right as GenericNameSyntax,
            AliasQualifiedNameSyntax alias => alias.Name as GenericNameSyntax,
            _ => null,
        };
        if (arity == 0) return type switch
        {
            IdentifierNameSyntax identifier => identifier.Identifier.ValueText == name,
            QualifiedNameSyntax qualified => qualified.Right.Identifier.ValueText == name,
            AliasQualifiedNameSyntax alias => alias.Name.Identifier.ValueText == name,
            _ => false,
        };
        return simple is not null && simple.Identifier.ValueText == name && simple.TypeArgumentList.Arguments.Count == arity;
    }

    private static bool PublicStatic(SyntaxTokenList modifiers) => modifiers.Any(SyntaxKind.PublicKeyword) && modifiers.Any(SyntaxKind.StaticKeyword);

    private static string OwnerName(MemberDeclarationSyntax member)
    {
        var owner = member.Ancestors().OfType<ClassDeclarationSyntax>().FirstOrDefault();
        if (owner is null || !PublicStatic(owner.Modifiers) || owner.TypeParameterList is not null || owner.Ancestors().OfType<ClassDeclarationSyntax>().Any()) return string.Empty;
        var prefix = NamespaceName(owner);
        return string.IsNullOrEmpty(prefix) ? owner.Identifier.ValueText : $"{prefix}.{owner.Identifier.ValueText}";
    }

    private static string NamespaceName(SyntaxNode node)
    {
        var names = node.Ancestors().OfType<BaseNamespaceDeclarationSyntax>().Select(value => value.Name.ToString()).Reverse();
        return string.Join('.', names);
    }
    private static bool QualifiedIdentifier(string value) => value.Split('.').Length >= 2
        && value.Split('.').All(part => SyntaxFacts.IsValidIdentifier(part));

    private static int Line(SyntaxNode node) => node.GetLocation().GetLineSpan().StartLinePosition.Line + 1;
    [DoesNotReturn]
    private static void Fail(SyntaxNode node, string message) => throw new SourceException(message, Line(node));
}
