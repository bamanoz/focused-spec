# Tasks

## 1. Workspaces and format seam

- [x] 1.1 Split core, packaged assets and adapters into npm workspaces; verify clean installation, ordered builds and pack inventories.
- [x] 1.2 Implement version-4 formats, public contract, consumer package/module resolution and reusable isolated hosts; verify exact plugin evidence and update owning configuration documentation.
- [x] 1.3 Preserve Markdown/Gherkin bindings in separate adapters and remove built-in dispatch; verify existing parser evidence and update public installation guidance.

## 2. Runners and consuming projects

- [x] 2.1 Implement Vitest, pytest and Go runner packages; verify exact collection and real pass/fail/skip/missing outcomes and document supported frameworks/options.
- [x] 2.2 Migrate repository, examples, evidence and evals to version 4 and framework-only names; verify existing CLI/evaluation gates and execute real examples.
- [x] 2.3 Update README and portable guidance for independent adapters/migration; verify documentation links and installed guidance/integration consumers.

## 3. Verification and lifecycle

- [x] 3.1 Bind and execute exact evidence; observe behavioral assertion FAIL under controlled regressions and restored PASS.
- [x] 3.2 Run full tests, minimum-Node CLI, clean workspace bootstrap and packed consumers; record results and any genuine model-evaluation limitations.

## Workflow follow-up

- Sync/archive verified deltas, preserve every surviving binding and execute the final selection. Do not publish or release.

## Observed verification

- `npm ci` in a source-only disposable workspace installed 99 packages and built all six workspaces. npm warned that the optional `fsevents` install script was not covered by `allowScripts`; no platform-specific script certification is claimed.
- `npm test`: 12 files and 178 tests passed, including test/eval TypeScript checks.
- Installed CLI strict validation and execution of `pluggable-formats-and-runners`: 28 PASS, 27 unique targets, no planned evidence.
- Every new scenario reference observed PASS → selected behavioral assertion FAIL under a reversible product regression → restored PASS; tests and selectors were unchanged.
- `npm pack --workspaces --dry-run --json` and actual independent tarball installation verified all six package inventories, licenses and public declarations. Core runtime dependencies are only glob, minimatch and yaml; the Python package contains only its reporter source, no bytecode.
- Node 22.16.0 executed real OpenSpec Go/pytest evidence and a source-independent six-package consumer with explicit swapped-extension Markdown/Gherkin layouts and all three official runners: 2 PASS, 3 targets.
- Real OpenSpec, Spec Kit, BMad and worktree-consumer examples passed. All 13 documentation pages are reachable through the indexes; relative file links and heading anchors checked without errors.
- Pre-sync all-scope execution: 177 PASS, 156 targets. Source-only root dist and the generated reporter bytecode cache were removed after smoke verification.
- Full black-box matrix results are retained separately as immutable eval artifacts; model-specific failures and unavailable native validators are not product or universal model passes.

## Black-box matrix

Model: `externcash/gpt-6.1-sol`. All nine rediscovered public cases and all seven native hosts in revision/create modes executed from an independent source-only workspace. Public results: six passed and three failed. Native authoring/evidence passed in all 14 runs; native validation passed for OpenSpec/Gherkin and is unverified for the other hosts. BMad regeneration lifecycle passed twice; other native lifecycle checks remain unverified. Every native process exits 2 and is not certified; this is not a universally green matrix.

- `project-upgrade`: failed protocol acquisition after the agent combined init and guidance JSON responses.
- `registry-shards-new-boundary` and `full-skill-routing`: failed integrity after genuine grep inspection of installed runner implementations. Gates and protected tests were not weakened.
- The first two native OpenSpec preparation attempts lacked copied host skills and failed before agent execution. Their failures are retained separately; after supplying those existing assets, genuine creation/revision runs passed authoring, evidence and host validation.
- Every invocation, exit status, gate verdict and immutable result path is recorded in `.eval-cache/architecture-matrix.json`; the initial setup failures remain in `.eval-cache/architecture-native-openspec-initial-setup-failures.json`. Historical eval artifacts remain unchanged.

| Invocation | Exit | Immutable result |
| --- | --- | --- |
| `node --experimental-strip-types evals/run.ts --case files-source-bootstrap --model externcash/gpt-6.1-sol --timeout 1200 --openspec-skills /Users/mak/src/focused-spec/.omp/skills` | 0 | `evals/results/files-source-bootstrap-1791796673151.json` |
| `node --experimental-strip-types evals/run.ts --case registry-shards-reuse --model externcash/gpt-6.1-sol --timeout 1200 --openspec-skills /Users/mak/src/focused-spec/.omp/skills` | 0 | `evals/results/registry-shards-reuse-1791796676625.json` |
| `node --experimental-strip-types evals/run.ts --case project-upgrade --model externcash/gpt-6.1-sol --timeout 1200 --openspec-skills /Users/mak/src/focused-spec/.omp/skills` | 1 | `evals/results/project-upgrade-1791796751424.json` |
| `node --experimental-strip-types evals/run.ts --case vacuous-evidence --model externcash/gpt-6.1-sol --timeout 1200 --openspec-skills /Users/mak/src/focused-spec/.omp/skills` | 0 | `evals/results/vacuous-evidence-1791796848473.json` |
| `node --experimental-strip-types evals/run.ts --case registry-shards-new-boundary --model externcash/gpt-6.1-sol --timeout 1200 --openspec-skills /Users/mak/src/focused-spec/.omp/skills` | 1 | `evals/results/registry-shards-new-boundary-1791796926166.json` |
| `node --experimental-strip-types evals/run.ts --case openspec-apply --model externcash/gpt-6.1-sol --timeout 1200 --openspec-skills /Users/mak/src/focused-spec/.omp/skills` | 0 | `evals/results/openspec-apply-1791796981844.json` |
| `node --experimental-strip-types evals/run.ts --case openspec-brownfield --model externcash/gpt-6.1-sol --timeout 1200 --openspec-skills /Users/mak/src/focused-spec/.omp/skills` | 0 | `evals/results/openspec-brownfield-1791797349142.json` |
| `node --experimental-strip-types evals/native-pilot.ts openspec externcash/gpt-6.1-sol` | 2 | `evals/results/native-openspec-1791797815626.json` |
| `node --experimental-strip-types evals/native-pilot.ts openspec externcash/gpt-6.1-sol --create` | 2 | `evals/results/native-create-openspec-1791797810705.json` |
| `node --experimental-strip-types evals/native-pilot.ts spec-kit externcash/gpt-6.1-sol` | 2 | `evals/results/native-spec-kit-1791797514126.json` |
| `node --experimental-strip-types evals/run.ts --case openspec-propose-apply --model externcash/gpt-6.1-sol --timeout 1200 --openspec-skills /Users/mak/src/focused-spec/.omp/skills` | 0 | `evals/results/openspec-propose-apply-1791797529098.json` |
| `node --experimental-strip-types evals/run.ts --case full-skill-routing --model externcash/gpt-6.1-sol --timeout 1200 --openspec-skills /Users/mak/src/focused-spec/.omp/skills` | 1 | `evals/results/full-skill-routing-1791797608128.json` |
| `node --experimental-strip-types evals/native-pilot.ts kiro externcash/gpt-6.1-sol` | 2 | `evals/results/native-kiro-1791797688724.json` |
| `node --experimental-strip-types evals/native-pilot.ts spec-kit externcash/gpt-6.1-sol --create` | 2 | `evals/results/native-create-spec-kit-1791797735687.json` |
| `node --experimental-strip-types evals/native-pilot.ts kiro externcash/gpt-6.1-sol --create` | 2 | `evals/results/native-create-kiro-1791797801857.json` |
| `node --experimental-strip-types evals/native-pilot.ts gsd externcash/gpt-6.1-sol` | 2 | `evals/results/native-gsd-1791797983775.json` |
| `node --experimental-strip-types evals/native-pilot.ts bmad externcash/gpt-6.1-sol` | 2 | `evals/results/native-bmad-1791798072662.json` |
| `node --experimental-strip-types evals/native-pilot.ts bmad externcash/gpt-6.1-sol --create` | 2 | `evals/results/native-create-bmad-1791798109184.json` |
| `node --experimental-strip-types evals/native-pilot.ts gsd externcash/gpt-6.1-sol --create` | 2 | `evals/results/native-create-gsd-1791798178137.json` |
| `node --experimental-strip-types evals/native-pilot.ts gherkin externcash/gpt-6.1-sol` | 2 | `evals/results/native-gherkin-1791798364652.json` |
| `node --experimental-strip-types evals/native-pilot.ts agent-os externcash/gpt-6.1-sol` | 2 | `evals/results/native-agent-os-1791798438412.json` |
| `node --experimental-strip-types evals/native-pilot.ts gherkin externcash/gpt-6.1-sol --create` | 2 | `evals/results/native-create-gherkin-1791798519280.json` |
| `node --experimental-strip-types evals/native-pilot.ts agent-os externcash/gpt-6.1-sol --create` | 2 | `evals/results/native-create-agent-os-1791798561620.json` |

Additional minimum-Node smoke: Node 22.16.0 loaded an erasable `.mts` format and `.ts` runner without caller-supplied Node flags and executed a real selected node:test assertion (1 PASS). Final independently installed core runtime bytes matched the restored build.
