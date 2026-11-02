import { cp, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { runProcess } from '../evals/process.ts'
import { executableBehaviorGates, executableSourceGate, inspectEstablishedComposition, integrationBoundaryGates, integrationFiles, integrationRoutingGate, selectedContractsGate } from '../evals/integration.ts'
import type { IntegrationBaseline } from '../evals/integration.ts'
import type { IntegrationCase } from '../evals/types.ts'
import { roots, repository, put, installFocusedPackage, guidanceTranscript, artifactGuidanceTranscript, activationFixture, boundaryFixture, bankFixture, configurationWrite, contractTranscript } from './fixtures/evals-suite.js'

vi.mock('../evals/result.ts', async importOriginal => {
  const actual = await importOriginal<typeof import('../evals/result.ts')>()
  return {
    ...actual,
    async saveEvalResult(_directory: string, prefix: string, result: unknown) {
      const directory = await mkdtemp(join(tmpdir(), 'focused-eval-test-results-'))
      roots.push(directory)
      return actual.saveEvalResult(directory, prefix, result)
    },
  }
})
describe('agent eval harness', () => {
  it('rejects unauthorized conversion of an existing integration', async () => {
    const choice: IntegrationCase = { source: 'inline', mode: 'revise', cli: true }
    const packages = ['focused-spec', '@focused-spec/format-inline', '@focused-spec/runner-go', '@focused-spec/runner-pytest']
    const config = JSON.stringify({ version: 5, specifications: { formats: { inline: { package: '@focused-spec/format-inline' } } } })
    const { root, baseline } = await boundaryFixture(packages, new Map([['specs/auth.md', '#### Scenario: Blocked\n- **ID**: `Opaque / Auth`\n- **EVIDENCE**: `go::target`\n- **WHEN** blocked\n- **THEN** rejected\n']]), config)
    expect((await integrationBoundaryGates(root, choice, baseline)).find(gate => gate.name === 'integration-preserve-existing')).toMatchObject({ passed: true })
    await put(root, '.focused-spec/config.yaml', config.replace('format-inline', 'format-registry'))
    expect((await integrationBoundaryGates(root, choice, baseline)).find(gate => gate.name === 'integration-preserve-existing')).toMatchObject({ passed: false })
    await put(root, '.focused-spec/config.yaml', config)
    await put(root, 'node_modules/@focused-spec/format-registry/package.json', '{"name":"@focused-spec/format-registry","version":"0.9.2"}')
    expect((await integrationBoundaryGates(root, choice, baseline)).find(gate => gate.name === 'integration-preserve-existing')).toMatchObject({ passed: false })
  })

  it('requires completed local integration guidance for composition selection', async () => {
    const root = await activationFixture()
    const baseline: IntegrationBaseline = { files: await integrationFiles(root), protected: new Map(), candidates: new Map(), native: new Map(), packages: ['focused-spec'], establishedComposition: ['focused-spec'] }
    const choice: IntegrationCase = { source: 'typescript', mode: 'integrate', cli: false }
    const content = '# Integration\n\nInspect the project before selecting capabilities.\n'
    await put(root, 'node_modules/focused-spec/guidance/integration.md', content)
    const command = `${JSON.stringify(process.execPath)} ${JSON.stringify(join(root, 'node_modules/focused-spec/dist/cli.js'))} instructions --protocol 1 --topic integration --json`
    const response = { protocolVersion: 1, package: { name: 'focused-spec', version: '0.6.0' }, topic: 'integration', content }
    const accepted = guidanceTranscript(root, { command, response })
    expect(await integrationRoutingGate(root, [guidanceTranscript(root, {
      command: 'focused-spec instructions --protocol 1 --topic integration --json', response,
    })], choice, baseline)).toMatchObject({ passed: true })
    expect(await integrationRoutingGate(root, [accepted + '\n' + configurationWrite()], choice, baseline)).toMatchObject({ passed: true })
    const hydration = JSON.stringify({ type: 'tool_execution_start', toolName: 'bash', toolCallId: 'hydrate', args: { command: 'npm install' } })
    expect(await integrationRoutingGate(root, [hydration + '\n' + accepted], choice, baseline)).toMatchObject({ passed: true })
    const install = JSON.stringify({ type: 'tool_execution_start', toolName: 'bash', toolCallId: 'select-sdk', args: { command: 'npm install --save-dev @focused-spec/scenarios-typescript' } })
    expect(await integrationRoutingGate(root, [install + '\n' + accepted], choice, baseline)).toMatchObject({ passed: false })
    expect(await integrationRoutingGate(root, [accepted + '\n' + install], choice, baseline)).toMatchObject({ passed: true })
    await put(root, 'package.json', JSON.stringify({ devDependencies: { '@focused-spec/scenarios-typescript': '0.10.1' } }))
    await put(root, 'package-lock.json', JSON.stringify({ lockfileVersion: 3, packages: { '': { devDependencies: { '@focused-spec/scenarios-typescript': '0.10.1' } } } }))
    expect(await integrationRoutingGate(root, [hydration + '\n' + accepted + '\n' + configurationWrite()], choice, baseline)).toMatchObject({ passed: true })
    for (const transcript of [
      guidanceTranscript(root, { command, response, complete: false }),
      guidanceTranscript(root, { command, response, failed: true }),
      guidanceTranscript(root, { command, response: { ...response, topic: 'workflow' } }),
      guidanceTranscript(root, { command, response: { ...response, package: { name: 'focused-spec', version: '0.5.0' } } }),
      guidanceTranscript(root, { command, response: { ...response, content: content.slice(0, 12) } }),
      configurationWrite() + '\n' + accepted,
    ]) expect(await integrationRoutingGate(root, [transcript], choice, baseline)).toMatchObject({ passed: false })
    const recovered = artifactGuidanceTranscript(root, { response }).replace('--topic workflow', '--topic integration')
    expect(await integrationRoutingGate(root, [recovered], choice, baseline)).toMatchObject({ passed: true })
  })

  it('distinguishes retained SDK composition from first selection', async () => {
    const project = await mkdtemp(join(tmpdir(), 'focused-eval-established-go-'))
    roots.push(project)
    await cp(join(repository, 'examples/scenarios/go'), project, { recursive: true, filter: path => !path.includes('node_modules') && !path.includes('.focused-spec') })
    await cp(join(repository, 'packages/sdk/go'), join(project, '.dependencies/scenarios-go'), { recursive: true })
    await put(project, 'go.mod', (await readFile(join(project, 'go.mod'), 'utf8')).replace('../../../packages/sdk/go', './.dependencies/scenarios-go'))
    const establishedComposition = await inspectEstablishedComposition(project, ['focused-spec'])
    const sdk = 'github.com/bamanoz/focused-spec/packages/sdk/go'
    expect(establishedComposition).toEqual(['focused-spec', sdk])

    const root = await activationFixture()
    const baseline: IntegrationBaseline = { files: await integrationFiles(root), protected: new Map(), candidates: new Map(), native: new Map(), packages: ['focused-spec'], establishedComposition }
    expect(await integrationRoutingGate(root, [], { source: 'go', mode: 'integrate', cli: false }, baseline)).toMatchObject({ passed: true })
    const absent = { ...baseline, establishedComposition: ['focused-spec'] }
    expect(await integrationRoutingGate(root, [], { source: 'go', mode: 'integrate', cli: false }, absent)).toMatchObject({ passed: false })
    expect(await integrationRoutingGate(root, [], { source: 'typescript', mode: 'integrate', cli: false }, absent)).toMatchObject({ passed: false })
    expect(await integrationRoutingGate(root, [], { source: 'go', mode: 'integrate', cli: true }, baseline)).toMatchObject({ passed: false })
    expect(await integrationRoutingGate(root, [], { source: 'go', mode: 'recommend', cli: false }, baseline)).toMatchObject({ passed: false })
  })

  it('treats an existing executable SDK suite as dependency repair rather than first SDK selection', async () => {
    const root = await activationFixture()
    const path = 'specifications/account.scenarios.mjs'
    await put(root, path, await readFile(join(repository, 'examples/scenarios/typescript', path), 'utf8'))
    const baseline: IntegrationBaseline = {
      files: await integrationFiles(root), protected: new Map(), candidates: new Map(), native: new Map(),
      packages: ['focused-spec'], establishedComposition: await inspectEstablishedComposition(root, ['focused-spec']),
    }
    const choice: IntegrationCase = { source: 'typescript', mode: 'author', cli: false }
    expect(await integrationRoutingGate(root, [], choice, baseline)).toMatchObject({ passed: true })
    expect(await integrationRoutingGate(root, [], { ...choice, cli: true }, baseline)).toMatchObject({ passed: false })

    await put(root, path, "// import { defineSuite } from '@focused-spec/scenarios-typescript';\nexport default {};\n")
    const unselected = { ...baseline, establishedComposition: await inspectEstablishedComposition(root, ['focused-spec']) }
    expect(await integrationRoutingGate(root, [], choice, unselected)).toMatchObject({ passed: false })
    expect(await integrationRoutingGate(root, [], choice, baseline)).toMatchObject({ passed: true })
  })

  it('rejects replacement of native acceptance items during integration', async () => {
    for (const source of ['openspec', 'spec-kit'] as const) {
      const path = source === 'openspec' ? 'openspec/specs/auth/spec.md' : 'specs/001-auth/spec.md'
      const native = source === 'openspec' ? '#### Scenario: Blocked account\n- **WHEN** valid credentials belong to a blocked account\n- **THEN** login is rejected\n'
        : '1. **Given** blocked status and valid credentials, **When** login is attempted, **Then** it is rejected.\n'
      const { root, baseline } = await boundaryFixture(['focused-spec'], new Map([[path, native]]))
      const choice: IntegrationCase = { source, mode: 'integrate', cli: true }
      await put(root, path, `<!-- focused-spec:id=Auth / Blocked -->\n${native}`)
      expect((await integrationBoundaryGates(root, choice, baseline)).find(gate => gate.name === 'integration-native-source')).toMatchObject({ passed: true })
      await put(root, path, '#### Scenario: Blocked\n- **ID**: `replacement`\n- **EVIDENCE**: `go::target`\n- **WHEN** blocked\n- **THEN** rejected\n')
      expect((await integrationBoundaryGates(root, choice, baseline)).find(gate => gate.name === 'integration-native-source')).toMatchObject({ passed: false })
    }
  })

  it('judges standalone compositions against the requested canonical source', async () => {
    const variants: readonly [IntegrationCase['source'], boolean, readonly string[]][] = [
      ['inline', true, ['focused-spec', '@focused-spec/format-inline', '@focused-spec/runner-go', '@focused-spec/runner-pytest']],
      ['typescript', false, ['focused-spec', '@focused-spec/scenarios-typescript']],
      ['typescript', true, ['focused-spec', '@focused-spec/scenarios-typescript', '@focused-spec/format-scenarios-typescript', '@focused-spec/runner-scenarios-typescript']],
      ['go', false, ['focused-spec']],
      ['go', true, ['focused-spec', '@focused-spec/format-scenarios-go', '@focused-spec/runner-scenarios-go']],
    ]
    for (const [source, cli, packages] of variants) {
      const choice: IntegrationCase = { source, cli, mode: 'integrate' }
      const { root, baseline } = await boundaryFixture(packages)
      expect((await integrationBoundaryGates(root, choice, baseline)).find(gate => gate.name === 'integration-composition')).toMatchObject({ passed: true })
      await put(root, 'node_modules/@focused-spec/format-gherkin/package.json', '{"name":"@focused-spec/format-gherkin","version":"0.9.2"}')
      expect((await integrationBoundaryGates(root, choice, baseline)).find(gate => gate.name === 'integration-composition')).toMatchObject({ passed: false })
      await rm(join(root, 'node_modules/@focused-spec/format-gherkin'), { recursive: true })
      if (!cli) {
        await put(root, '.focused-spec/config.yaml', 'version: 5\n')
        expect((await integrationBoundaryGates(root, choice, baseline)).find(gate => gate.name === 'integration-composition')).toMatchObject({ passed: false })
      }
    }
  })

  it('rejects configuration writes during recommendation or installation only', async () => {
    for (const mode of ['recommend', 'install'] as const) {
      const { root, baseline } = await boundaryFixture(['focused-spec'])
      const choice: IntegrationCase = { source: 'inline', cli: false, mode }
      expect((await integrationBoundaryGates(root, choice, baseline)).find(gate => gate.name === 'integration-phase-boundary')).toMatchObject({ passed: true })
      await put(root, '.omp/skills/focused-spec/SKILL.md', 'loader')
      expect((await integrationBoundaryGates(root, choice, baseline)).find(gate => gate.name === 'integration-phase-boundary')).toMatchObject({ passed: mode === 'install' })
      await put(root, '.focused-spec/config.yaml', 'version: 5\n')
      expect((await integrationBoundaryGates(root, choice, baseline)).find(gate => gate.name === 'integration-phase-boundary')).toMatchObject({ passed: false })
      await rm(join(root, '.focused-spec'), { recursive: true })
      await put(root, 'node_modules/@focused-spec/format-inline/package.json', '{"name":"@focused-spec/format-inline","version":"0.9.2"}')
      expect((await integrationBoundaryGates(root, choice, baseline)).find(gate => gate.name === 'integration-phase-boundary')).toMatchObject({ passed: false })
    }
  })

  it('requires selected installed contracts before integration configuration', async () => {
    const root = await activationFixture()
    await installFocusedPackage(root)
    const names = ['@focused-spec/format-registry', '@focused-spec/format-markdown']
    const transcripts: string[] = []
    for (const name of names) {
      await put(root, `node_modules/${name}/README.md`, `# ${name}\n\nInstalled public authoring contract.\n`)
      const args = [join(root, 'node_modules/focused-spec/dist/cli.js'), 'plugin-docs', '--package', name, '--root', root, '--json']
      const result = await runProcess(process.execPath, args, { cwd: root, timeoutMs: 10_000 })
      expect(result.code, result.stderr).toBe(0)
      const command = [process.execPath, ...args].map(value => JSON.stringify(value)).join(' ')
      transcripts.push(contractTranscript(command, result.stdout))
      expect(await selectedContractsGate(root, [transcripts[0]!], names)).toMatchObject({ passed: false })
    }
    const complete = transcripts.join('\n')
    expect(await selectedContractsGate(root, [complete + '\n' + configurationWrite()], names)).toMatchObject({ passed: true })
    expect(await selectedContractsGate(root, [transcripts[0]! + '\n' + configurationWrite() + '\n' + transcripts[1]!], names)).toMatchObject({ passed: false })
    const altered = complete.replace('Installed public authoring contract.', 'stale contract')
    expect(await selectedContractsGate(root, [altered], names)).toMatchObject({ passed: false })
    expect(await selectedContractsGate(root, [complete.replaceAll('"exitCode":0', '"exitCode":1')], names)).toMatchObject({ passed: false })
    expect(await selectedContractsGate(root, [complete.split('\n').filter(line => JSON.parse(line).type !== 'tool_execution_end').join('\n')], names)).toMatchObject({ passed: false })
  })

  it('accepts complete selected contract artifact recovery before configuration writes', async () => {
    const root = await activationFixture()
    await installFocusedPackage(root)
    await put(root, '.focused-spec/config.yaml', [
      'version: 5',
      'specifications:',
      '  formats:',
      '    inline:',
      "      package: '@focused-spec/format-inline'",
      '  documents:',
      '    - match: specs/**/*.md',
      '      scope: current',
      '      format: inline',
      'runners:',
      '  go:',
      "    package: '@focused-spec/runner-go'",
      '  pytest:',
      "    package: '@focused-spec/runner-pytest'",
    ].join('\n'))
    const selections = [
      { kind: 'format', selector: 'inline', name: '@focused-spec/format-inline', source: 'formats/inline', footer: 'raw', chain: false },
      { kind: 'runner', selector: 'go', name: '@focused-spec/runner-go', source: 'runners/go', footer: 'read', chain: false },
      { kind: 'runner', selector: 'pytest', name: '@focused-spec/runner-pytest', source: 'runners/pytest', footer: 'read', chain: true },
    ] as const
    type RecordedToolEvent = {
      type: 'tool_execution_start' | 'tool_execution_end'
      toolName: 'bash' | 'read'
      toolCallId: string
      args?: { command?: string; path?: string }
      isError?: boolean
      result?: { isError?: boolean; content: { type: 'text'; text: string }[]; details?: { exitCode: number } }
    }
    const recoveryEvents: RecordedToolEvent[] = []
    const responses = new Map<string, string>()
    for (const selection of selections) {
      await cp(join(repository, 'packages', selection.source, 'README.md'), join(root, 'node_modules', selection.name, 'README.md'))
      const args = ['plugin-docs', `--${selection.kind}`, selection.selector, '--root', root, '--json']
      const result = await runProcess(process.execPath, [join(root, 'node_modules/focused-spec/dist/cli.js'), ...args], { cwd: root, timeoutMs: 10_000 })
      expect(result.code, result.stderr).toBe(0)
      responses.set(selection.name, result.stdout)
      const commandId = `${selection.selector}-command`
      const firstArtifact = `artifact://${selection.selector}-preview`
      const finalArtifact = selection.chain ? `artifact://${selection.selector}-full` : firstArtifact
      const footer = selection.footer === 'raw'
        ? `[raw output: ${firstArtifact}]`
        : `[Some lines truncated to 768 bytes. Read ${firstArtifact} for full output]`
      recoveryEvents.push(
        { type: 'tool_execution_start', toolName: 'bash', toolCallId: commandId,
          args: { command: `focused-spec ${args.slice(0, -3).join(' ')} --root . --json` } },
        { type: 'tool_execution_end', toolName: 'bash', toolCallId: commandId,
          result: { content: [{ type: 'text', text: `{ "selection": "${selection.selector}", … }\n\n${footer}\n\nWall time: 0.12 seconds` }], details: { exitCode: 0 } } },
      )
      if (selection.chain) recoveryEvents.push(
        { type: 'tool_execution_start', toolName: 'read', toolCallId: `${selection.selector}-preview`, args: { path: firstArtifact } },
        { type: 'tool_execution_end', toolName: 'read', toolCallId: `${selection.selector}-preview`,
          result: { content: [{ type: 'text', text: `{ "selection": "${selection.selector}", … }\n\n[raw output: ${finalArtifact}]\n\nWall time: 0.04 seconds` }] } },
      )
      recoveryEvents.push(
        { type: 'tool_execution_start', toolName: 'read', toolCallId: `${selection.selector}-document`, args: { path: finalArtifact } },
        { type: 'tool_execution_end', toolName: 'read', toolCallId: `${selection.selector}-document`,
          result: { content: [{ type: 'text', text: `${result.stdout}\n\nWall time: 0.03 seconds` }] } },
      )
    }
    const names = selections.map(selection => selection.name)
    const writeEvent = JSON.parse(configurationWrite()) as Record<string, unknown>
    const complete = recoveryEvents.map(event => JSON.stringify(event)).join('\n')
    expect(await selectedContractsGate(root, [`${complete}\n${configurationWrite()}`], names)).toMatchObject({ passed: true })

    const pytestRead = recoveryEvents.findIndex(event => event.type === 'tool_execution_start' && event.toolCallId === 'pytest-document')
    const premature = [...recoveryEvents.slice(0, pytestRead), writeEvent, ...recoveryEvents.slice(pytestRead)]
    const wrong = recoveryEvents.map(event => event.type === 'tool_execution_start' && event.toolCallId === 'inline-document'
      ? { ...event, args: { path: 'artifact://unlinked' } }
      : event)
    const unfinished = recoveryEvents.filter(event => !(event.type === 'tool_execution_end' && event.toolCallId === 'go-document'))
    const failed = recoveryEvents.map(event => event.type === 'tool_execution_end' && event.toolCallId === 'go-document'
      ? { ...event, isError: true, result: { ...event.result!, isError: true, details: { exitCode: 1 } } }
      : event)
    const staleResponse = JSON.parse(responses.get('@focused-spec/runner-pytest')!) as { document: { content: string } }
    staleResponse.document.content = 'stale installed contract'
    const stale = recoveryEvents.map(event => event.type === 'tool_execution_end' && event.toolCallId === 'pytest-document'
      ? { ...event, result: { content: [{ type: 'text' as const, text: JSON.stringify(staleResponse) }] } }
      : event)
    for (const rejected of [premature, wrong, unfinished, failed, stale]) {
      expect(await selectedContractsGate(root, [rejected.map(event => JSON.stringify(event)).join('\n')], names)).toMatchObject({ passed: false })
    }
  })

  it('rejects duplicate behavioral sources beside executable scenarios', async () => {
    const root = await bankFixture()
    const choice: IntegrationCase = { source: 'typescript', mode: 'author', cli: false }
    expect(await executableSourceGate(root, choice)).toMatchObject({ passed: true })
    await put(root, 'specs/account.md', '#### Scenario: Withdraw entire balance\n- **THEN** withdrawal is allowed\n')
    expect(await executableSourceGate(root, choice)).toMatchObject({ passed: false })
    await rm(join(root, 'specs'), { recursive: true })
    await put(root, '.focused-spec/evidence/bank.yaml', 'scopes: {}\n')
    expect(await executableSourceGate(root, choice)).toMatchObject({ passed: false })
  })

  it('rejects executable evidence disconnected from the mutated application', async () => {
    const root = await bankFixture()
    const choice: IntegrationCase = { source: 'typescript', mode: 'author', cli: false }
    const path = 'specifications/account.driver.mjs'
    const original = await readFile(join(root, path), 'utf8')
    expect((await executableBehaviorGates(root, choice)).find(gate => gate.name === 'executable-application-sensitivity')).toMatchObject({ passed: true })
    await put(root, path, "import suite from './account.scenarios.mjs';\nexport default {given: x=>x, when: (_subject, command)=>structuredClone(suite.scenarios.find(item=>JSON.stringify(item.when)===JSON.stringify(command)).expect)};\n")
    expect((await executableBehaviorGates(root, choice)).find(gate => gate.name === 'executable-application-sensitivity')).toMatchObject({ passed: false })
    await put(root, path, "export default {given: history=>history, when: (_subject, command)=>[{type:'MoneyWithdrawn', cents:command.cents}]};\n")
    expect((await executableBehaviorGates(root, choice)).find(gate => gate.name === 'executable-application-sensitivity')).toMatchObject({ passed: false })
    await put(root, path, original)
    expect((await executableBehaviorGates(root, choice)).find(gate => gate.name === 'executable-application-sensitivity')).toMatchObject({ passed: true })
  })

  it('rejects observations that conceal the claimed application regression', async () => {
    const root = await bankFixture()
    const choice: IntegrationCase = { source: 'typescript', mode: 'author', cli: false }
    const suitePath = 'specifications/account.scenarios.mjs', driverPath = 'specifications/account.driver.mjs'
    const suite = await readFile(join(root, suitePath), 'utf8'), driver = await readFile(join(root, driverPath), 'utf8')
    await put(root, suitePath, "import {defineSuite} from '@focused-spec/scenarios-typescript';\nimport {Account} from '../src/account.mjs';\nconst given=[{type:'AccountOpened'},{type:'MoneyDeposited',cents:5000}], when={type:'WithdrawMoney',cents:5000};\nexport default defineSuite({driver:'./account.driver.mjs',scenarios:[{id:'account.withdraw.entire-balance',name:'Withdrawing the entire balance is allowed',given,when,expect:Account.from(given).handle(when)}]});\n")
    const derived = await executableBehaviorGates(root, choice)
    expect(derived.find(gate => gate.name === 'executable-independent-expectation')).toMatchObject({ passed: false })
    expect(derived.find(gate => gate.name === 'executable-application-sensitivity')).toMatchObject({ passed: false })
    await put(root, suitePath, suite.replaceAll("expect: [{ type: 'MoneyWithdrawn', cents: 5000 }]", 'expect: []'))
    await put(root, driverPath, "import {Account} from '../src/account.mjs';\nexport default {given: history=>Account.from(history), when: (account, command)=>{account.handle(command); return []}};\n")
    expect((await executableBehaviorGates(root, choice)).find(gate => gate.name === 'executable-application-sensitivity')).toMatchObject({ passed: false })
    await put(root, suitePath, suite); await put(root, driverPath, driver)
    expect((await executableBehaviorGates(root, choice)).find(gate => gate.name === 'executable-application-sensitivity')).toMatchObject({ passed: true })
  })

  it('rejects diagnostic success when selected behavioral comparison fails', async () => {
    const root = await bankFixture()
    const choice: IntegrationCase = { source: 'typescript', mode: 'author', cli: false }
    const path = 'specifications/account.driver.mjs', original = await readFile(join(root, path), 'utf8')
    await put(root, path, "import {Account} from '../src/account.mjs';\nexport default {given: history=>Account.from(history), when: (account, command, context)=>{context.explain('Withdrawal allowed and codec roundtrip passed'); account.handle(command); return []}};\n")
    const diagnostic = await executableBehaviorGates(root, choice)
    expect(diagnostic.find(gate => gate.name === 'executable-native-execution')).toMatchObject({ passed: false })
    expect(diagnostic.find(gate => gate.name === 'executable-application-sensitivity')).toMatchObject({ passed: false })
    await put(root, path, "export default {given: value=>value, when: ()=>{throw new Error('runner setup failed')}};\n")
    expect((await executableBehaviorGates(root, choice)).find(gate => gate.name === 'executable-application-sensitivity')).toMatchObject({ passed: false })
    await put(root, path, original)
    const wrapper = await readFile(join(root, 'test/account.node.mjs'), 'utf8')
    await put(root, 'test/account.node.mjs', wrapper.replace('test(scenario.name,', 'test.skip(scenario.name,'))
    expect((await executableBehaviorGates(root, choice)).find(gate => gate.name === 'executable-application-sensitivity')).toMatchObject({ passed: false })
    await put(root, 'test/account.node.mjs', wrapper)
    expect((await executableBehaviorGates(root, choice)).find(gate => gate.name === 'executable-application-sensitivity')).toMatchObject({ passed: true })
  })
})
