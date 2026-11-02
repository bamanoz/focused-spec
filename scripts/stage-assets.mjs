import { cp, copyFile, readFile, rm, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const root = fileURLToPath(new URL('../', import.meta.url))
const core = join(root, 'packages/core')
const publicBase = 'https://github.com/bamanoz/focused-spec/blob/v0.11.0/'
const publicTree = 'https://github.com/bamanoz/focused-spec/tree/v0.11.0/'

for (const asset of ['skills', 'guidance']) {
  await rm(join(core, asset), { recursive: true, force: true })
  await cp(join(root, asset), join(core, asset), { recursive: true })
}

const readme = (await readFile(join(root, 'README.md'), 'utf8'))
  .replace('src="./assets/focused-spec.svg"', 'src="https://raw.githubusercontent.com/bamanoz/focused-spec/main/assets/focused-spec.svg"')
  .replace('[in the checkout](test/fixtures/onboarding/)', 'in the source checkout only (`test/fixtures/onboarding/`)')
  .replaceAll('](packages/', `](${publicBase}packages/`)
  .replaceAll('](examples/', `](${publicTree}examples/`)
  .replaceAll('](docs/', `](${publicBase}docs/`)
  .replaceAll('](test/', `](${publicTree}test/`)
  .replaceAll('](LICENSE)', `](${publicBase}LICENSE)`)
await writeFile(join(core, 'README.md'), readme)

for (const name of ['core', 'sdk/typescript', 'sdk/go', 'formats/markdown', 'formats/gherkin', 'formats/inline', 'formats/registry', 'formats/scenarios-typescript', 'formats/scenarios-go', 'formats/scenarios-python', 'formats/scenarios-dotnet', 'runners/vitest', 'runners/pytest', 'runners/go', 'runners/scenarios-typescript', 'runners/scenarios-go', 'runners/scenarios-python', 'runners/scenarios-dotnet']) {
  await copyFile(join(root, 'LICENSE'), join(root, 'packages', name, 'LICENSE'))
}

const runnerReadmes = {
  'runners/vitest': `# @focused-spec/runner-vitest

Run exact tests from a consumer-owned Vitest 4 suite. Requires Node.js 22.16.0+, focused-spec, this package, and consumer-installed Vitest.

\`\`\`sh
npm install --save-dev focused-spec @focused-spec/runner-vitest vitest
\`\`\`

Register \`vitest\`. Selectors use \`<project-relative-file>::<full test name>\`; nested names join with \` > \`. Missing, ambiguous, skipped or unexecuted tests do not pass.

| ID | Example selector |
| --- | --- |
| \`vitest\` | \`test/a.spec.ts::outer > inner > works\` |

Options are omitted/null or \`{ command?: string, commandArgs?: string[] }\`; the default command is Node. Package resolution starts from the consumer project.

See the [shared runner guide](${publicBase}docs/guides/runners.md) and [Runner API reference](${publicBase}docs/reference/runner-api.md).
`,
  'runners/pytest': `# @focused-spec/runner-pytest

Run exact tests from a consumer-owned pytest 8/9 suite. Requires Node.js 22.16.0+, Python 3.10+, focused-spec, this package, and pytest in the selected Python environment.

\`\`\`sh
npm install --save-dev focused-spec @focused-spec/runner-pytest
python -m pip install pytest
\`\`\`

Register \`pytest\`. Selectors are exact collector node IDs; a parameterized parent matching multiple cases is ambiguous.

| ID | Example selector |
| --- | --- |
| \`pytest\` | \`tests/test_auth.py::test_blocked_account\` |

Options are omitted/null or \`{ command?: string, commandArgs?: string[] }\`; the default command is \`python\`, followed by \`-m pytest\`. Skipped, missing or unexecuted tests do not pass.

See the [shared runner guide](${publicBase}docs/guides/runners.md) and [Runner API reference](${publicBase}docs/reference/runner-api.md).
`,
  'runners/go': `# @focused-spec/runner-go

Run exact tests from a consumer-owned Go 1.22+ module. Install Node.js 22.16.0+, focused-spec, this package, and Go in the consuming project.

\`\`\`sh
npm install --save-dev focused-spec @focused-spec/runner-go
\`\`\`

Register \`go\`. Selectors use \`<go-package>::<top-level TestName>\`; a test file selects its containing package. Selecting a parent conservatively aggregates its subtests.

| ID | Example selector |
| --- | --- |
| \`go\` | \`./auth::TestLogin\` |

Options are omitted/null or \`{ command?: string, commandArgs?: string[] }\`; the default command is \`go\`. Missing or unexecuted selected tests do not pass.

See the [shared runner guide](${publicBase}docs/guides/runners.md) and [Runner API reference](${publicBase}docs/reference/runner-api.md).
`,
  'runners/scenarios-typescript': `# @focused-spec/runner-scenarios-typescript

Execute native JavaScript/TypeScript suites from \`@focused-spec/scenarios-typescript\` on Node.js 22.16.0+. Install the SDK, this runner, its format package, and a project-local focused-spec installation.

\`\`\`sh
npm install --save-dev focused-spec @focused-spec/scenarios-typescript @focused-spec/format-scenarios-typescript @focused-spec/runner-scenarios-typescript
\`\`\`

Register \`scenarios\`. Selectors are JSON tuples such as \`scenarios::["specifications/account.scenarios.mjs","account.withdraw.entire-balance"]\`, not test titles.

See the [native format](${publicBase}packages/formats/scenarios-typescript/README.md), [SDK](${publicBase}packages/sdk/typescript/README.md), and [shared runner guide](${publicBase}docs/guides/runners.md).
`,
  'runners/scenarios-go': `# @focused-spec/runner-scenarios-go

Execute native Go suites through the independent Go SDK. Install Node.js 22.16.0+, Go 1.23+, this runner, its format package, and the SDK module in the consumer's Go module. The SDK is not installed by npm.

\`\`\`sh
npm install --save-dev focused-spec @focused-spec/format-scenarios-go @focused-spec/runner-scenarios-go
\`\`\`

Register \`scenarios-go\`. Selectors are JSON tuples such as \`scenarios-go::["specifications/account.scenarios.go","account.withdraw.entire-balance"]\`.

See the [native format](${publicBase}packages/formats/scenarios-go/README.md), [Go SDK](${publicBase}packages/sdk/go/README.md), and [shared runner guide](${publicBase}docs/guides/runners.md).
`,
  'runners/scenarios-python': `# @focused-spec/runner-scenarios-python

Execute native Python suites through \`focused-spec-scenarios\`. Install Node.js 22.16.0+, Python 3.11+, this runner and its format package from npm, and the independent SDK from PyPI in the interpreter environment.

\`\`\`sh
npm install --save-dev focused-spec @focused-spec/format-scenarios-python @focused-spec/runner-scenarios-python
# use the same selected Python 3.11+ environment for native execution
python3 -m pip install focused-spec-scenarios
\`\`\`

Register \`scenarios-python\`. Selectors are JSON tuples such as \`scenarios-python::["specifications/account_scenarios.py","account.withdraw.entire-balance"]\`.

See the [native format](${publicBase}packages/formats/scenarios-python/README.md), [Python SDK](${publicBase}packages/sdk/python/README.md), and [shared runner guide](${publicBase}docs/guides/runners.md).
`,
  'runners/scenarios-dotnet': `# @focused-spec/runner-scenarios-dotnet

Execute native .NET suites through \`FocusedSpec.Scenarios\`. Install Node.js 22.16.0+, .NET SDK 9+, this runner and its format package from npm, and the independent SDK from the [GitHub Release/local NuGet guide](${publicBase}docs/guides/install.md#net-sdk-from-github-releases). The format tarball includes its prebuilt parser.

\`\`\`sh
npm install --save-dev focused-spec @focused-spec/format-scenarios-dotnet @focused-spec/runner-scenarios-dotnet
\`\`\`

Register \`scenarios-dotnet\` with one contained project and framework. Selectors are JSON tuples such as \`scenarios-dotnet::["Bank/AccountScenarios.cs","account.withdraw.entire-balance"]\`.

See the [native format](${publicBase}packages/formats/scenarios-dotnet/README.md), [SDK](${publicBase}packages/sdk/dotnet/FocusedSpec.Scenarios/README.md), and [shared runner guide](${publicBase}docs/guides/runners.md).
`,
}

for (const [name, content] of Object.entries(runnerReadmes)) {
  await writeFile(join(root, 'packages', name, 'README.md'), content)
}
