# @focused-spec/format-scenarios-dotnet

Optional syntax-only .NET scenario discovery for focused-spec Format API 2. It requires Node.js 22.16.0+ and a .NET 9+ host. Applications reference the independent `FocusedSpec.Scenarios` NuGet package; the npm format does not install it.

## Installation and registration

```sh
npm install --save-dev focused-spec @focused-spec/format-scenarios-dotnet @focused-spec/runner-scenarios-dotnet
```

```yaml
version: 5
specifications:
  formats:
    scenarios-dotnet:
      package: '@focused-spec/format-scenarios-dotnet'
      options: { runner: scenarios-dotnet }
  documents:
    - { match: 'Bank/AccountScenarios.cs', scope: current, format: scenarios-dotnet }
runners:
  scenarios-dotnet:
    package: '@focused-spec/runner-scenarios-dotnet'
    timeoutMs: 300000
    options: { project: 'Bank/ScenarioBank.Bank.csproj', framework: net9.0 }
```

Format options are exactly `{ runner, command? }`; `command` defaults to `dotnet` and is one executable name or absolute path.

## Supported source grammar

A source has one public static `ScenarioSuite<TGiven,TWhen,TExpect>` field in a named, non-generic public static class and namespace. Its constructor contains a literal scenario collection and a literal `ScenarioDriverBinding(path, export)`. Each scenario is an inline target-typed or explicit `Scenario<...>` constructor with literal `id`, `name`, `given`, `when`, and `expect` arguments. Positional and named constructor arguments are accepted without duplicates.

Data may use null, booleans, strings, finite numeric literals, negative numeric literals, collection and array initializers, and typed or target-typed object construction with recursively literal arguments and object/collection initializers. Qualified and generic type syntax and imports remain inert. Calls, references to computed values, interpolation, spreads, duplicate fields, duplicate IDs, missing fields, dynamic collections, and conditional directives are rejected at their source line.

The driver path may be the suite source. `Export` is a fully qualified public static field or parameterless property returning `ScenarioDriver<...>`. Driver lookup parses that member but never evaluates its initializer or getter.

## Static helper and public catalog

The package ships a prebuilt framework-dependent .NET 9 Roslyn parser, its runtime configuration, dependency assemblies, and notices in `dist/dotnet`. Discovery invokes that DLL directly; it does not restore, compile, evaluate a project, load a consumer assembly, run source generators, or execute initializers. Runtime roll-forward permits newer .NET runtimes. Build maintainers need the .NET 9 SDK and NuGet access to restore pinned `Microsoft.CodeAnalysis.CSharp` 4.14.0 before publishing the npm package. Consumers need no parser restore or network access.

Inputs, stdout, and stderr are limited to 4,000,000 bytes. Derived selectors are `JSON.stringify([projectRelativeSuitePath, exactScenarioId])`; paths are forward-slash project-relative `.cs` paths without empty, absolute, traversal, backslash, or control components.

`@focused-spec/format-scenarios-dotnet/catalog` exports `readCatalog`, `readDriver`, `encodeSelector`, `decodeSelector`, `CatalogError`, and catalog types. `readCatalog` and `readDriver` accept optional abort signals and a direct .NET host command. The official runner consumes this same syntax contract.

```ts
interface Catalog {
  readonly suite: {
    readonly namespaceName: string
    readonly typeName: string
    readonly exportName: string
    readonly driver: { readonly path: string; readonly exportName: string }
  }
  readonly scenarios: readonly { readonly id: string; readonly name: string; readonly line: number }[]
}

readCatalog(path: string, source: string, signal?: AbortSignal, command?: string): Promise<Catalog>
readDriver(path: string, source: string, exportName: string, signal?: AbortSignal, command?: string): Promise<{ readonly typeName: string; readonly exportName: string }>
encodeSelector(path: string, id: string): string
decodeSelector(selector: string): readonly [string, string]
```
