import { spawnSync } from 'node:child_process'
import { cp, mkdir, mkdtemp, readFile, readdir, rm, stat, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { decodeSelector, encodeSelector, readCatalog } from '@focused-spec/format-scenarios-go/catalog'
import runner from '@focused-spec/runner-scenarios-go'

const repository = fileURLToPath(new URL('..', import.meta.url))
const sdkModule = 'github.com/bamanoz/focused-spec/packages/sdk/go'
const suitePath = 'specifications/suite.scenarios.go'
const configuration = {
  version: 5,
  specifications: {
    formats: { go: { package: '@focused-spec/format-scenarios-go', options: { runner: 'scenarios-go' } } },
    documents: [{ match: 'specifications/*.scenarios.go', scope: 'current', format: 'go' }],
  },
  runners: { 'scenarios-go': { package: '@focused-spec/runner-scenarios-go', timeoutMs: 120000 } },
}
let temporary: string
const tarballs = new Map<string, string>()

async function put(root: string, path: string, content: string) {
  await mkdir(dirname(join(root, path)), { recursive: true })
  await writeFile(join(root, path), content)
}
function command(root: string, executable: string, args: string[], timeout = 120000) {
  return spawnSync(executable, args, { cwd: root, encoding: 'utf8', timeout, maxBuffer: 8000000, env: { ...process.env, GOWORK: 'off', GOTOOLCHAIN: 'local' } })
}
function cli(root: string, ...args: string[]) {
  return command(root, process.execPath, [join(root, 'node_modules/focused-spec/dist/cli.js'), ...args, '--json'])
}
function passed(result: ReturnType<typeof command>) { expect(result.status, result.stdout + result.stderr + String(result.error ?? '')).toBe(0) }
function source(ids = ['account', 'unselected']) {
  return `package specifications
import scenarios "${sdkModule}"
var Account = scenarios.Suite[int, int, int]{
 Driver: scenarios.DriverBinding{Path:"driver.go", Export:"AccountDriver"},
 Scenarios: []scenarios.Scenario[int,int,int]{
${ids.map((id, index) => `  {ID:${JSON.stringify(id)},Name:"bank observation",Given:5,When:${index === 0 ? 5 : 99},Expect:0},`).join('\n')}
 },
}
`
}
function driver(action = 'return subject - value, nil', initializer = '') {
  return `package specifications
import (
 "context"
 "os"
 "strconv"
 scenarios "${sdkModule}"
)
${initializer}
var AccountDriver = scenarios.Driver[int,int,int,int]{
 Given:func(ctx context.Context, value int)(int,error){return value,nil},
 When:func(ctx context.Context,subject int,value int)(int,error){
  f,err:=os.OpenFile("actions",os.O_CREATE|os.O_APPEND|os.O_WRONLY,0600); if err != nil {return 0,err}; defer f.Close(); f.WriteString(strconv.Itoa(value)+"\\n")
  ${action}
 },
}
`
}
async function project() {
  const root = await mkdtemp(join(temporary, 'project-'))
  await put(root, 'go.mod', `module example.com/go-consumer\n\ngo 1.23\n\nrequire ${sdkModule} v0.0.0\nreplace ${sdkModule} => ${join(repository, 'packages/sdk/go')}\n`)
  await put(root, 'package.json', '{"name":"go-consumer","private":true,"type":"module"}')
  await symlink(join(repository, 'node_modules'), join(root, 'node_modules'), 'dir')
  await put(root, '.focused-spec/config.yaml', JSON.stringify(configuration))
  await put(root, suitePath, source())
  await put(root, 'specifications/driver.go', driver())
  return root
}
async function bankProject(withNodeModules = false) {
  const root = await mkdtemp(join(temporary, 'go-bank-'))
  await cp(join(repository, 'examples/scenarios/go'), root, { recursive: true, filter: path => !path.includes('node_modules') })
  await put(root, 'go.mod', `module example.com/scenario-bank\n\ngo 1.23\nrequire ${sdkModule} v0.0.0\nreplace ${sdkModule} => ${join(repository, 'packages/sdk/go')}\n`)
  if (withNodeModules) await symlink(join(repository, 'node_modules'), join(root, 'node_modules'), 'dir')
  return root
}
function context(root: string, signal = new AbortController().signal) { return { projectRoot: root, cwd: root, runnerId: 'scenarios-go', options: null, signal } }

beforeAll(async () => {
  temporary = await mkdtemp(join(tmpdir(), 'focused-go-scenarios-'))
  for (const directory of ['core', 'formats/scenarios-go', 'runners/scenarios-go']) {
    const root = join(repository, 'packages', directory)
    const result = command(root, 'npm', ['pack', '--ignore-scripts', '--pack-destination', temporary, '--json'])
    passed(result)
    const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')) as { name: string }
    tarballs.set(manifest.name, join(temporary, (JSON.parse(result.stdout) as {filename:string}[])[0]!.filename))
  }
}, 120000)
afterAll(async () => { if (temporary) await rm(temporary, { recursive: true, force: true }) })

async function sdkProbe(body: string, declarations = '') {
  const root = await mkdtemp(join(temporary, 'sdk-only-'))
  await cp(join(repository, 'packages/sdk/go'), join(root, 'sdk'), { recursive: true })
  await put(root, 'go.mod', `module example.com/sdk-only\n\ngo 1.23\nrequire ${sdkModule} v0.0.0\nreplace ${sdkModule} => ./sdk\n`)
  await put(root, 'main.go', `package main
import("context";"encoding/json";"errors";"fmt";"reflect";"os";"strings";"sync";scenarios "${sdkModule}")
var _ = json.Marshal; var _ = errors.Is; var _ = reflect.DeepEqual; var _ = os.Exit; var _ = strings.Contains; var _ = sync.WaitGroup{}
func check(ok bool, message string){if !ok{panic(message)}}
${declarations}
func main(){ctx:=context.Background(); _=ctx; ${body}; fmt.Println("verified")}
`)
  const result = command(root, 'go', ['run', '.'])
  passed(result)
  expect(result.stdout).toBe('verified\n')
  await expect(stat(join(root, 'node_modules'))).rejects.toMatchObject({ code: 'ENOENT' })
}
const simple = `s:=scenarios.Scenario[int,int,int]{ID:"account",Name:"subtract",Given:5,When:5,Expect:0}; d:=scenarios.Driver[int,int,int,int]{Given:func(ctx context.Context,v int)(int,error){return v,nil},When:func(ctx context.Context,s int,v int)(int,error){return s-v,nil}};`

describe('Go executable scenarios', () => {
  it('executes the Go SDK without Node dependencies', async () => {
    await sdkProbe(`${simple} d.When=func(ctx context.Context,s int,v int)(int,error){scenarios.Explain(ctx,"subtracted",map[string]any{"value":v});return s-v,nil}; s.When=3; s.Expect=2; actual,err:=scenarios.VerifySpecification(ctx,d,s); check(err==nil && actual==2,"real subtraction did not pass"); s.Expect=9; _,err=scenarios.VerifySpecification(ctx,d,s); check(err!=nil,"incorrect expectation passed")`)
  }, 120000)
  it('observes actual Go verification through one event channel', async () => {
    await sdkProbe(`${simple} s.When=3; s.Expect=9; events:=[]scenarios.ExecutionEvent{}; ctx=scenarios.WithEvents(ctx,func(event scenarios.ExecutionEvent){events=append(events,event)}); d.When=func(ctx context.Context,s int,v int)(int,error){scenarios.Explain(ctx,"subtracted",map[string]any{"operand":v});return s-v,nil}; actual,err:=scenarios.VerifySpecification(ctx,d,s); check(actual==2 && err!=nil,"exact mismatch did not fail"); check(len(events)==5,"event count or actual missing"); names:=[]string{"Given","When","Expect"}; for index,name:=range names{event,ok:=events[index].(scenarios.ObservationEvent);check(ok && event.Name==name,"declared observation order changed")}; explanation,ok:=events[3].(scenarios.ExplanationEvent);check(ok && explanation.Message=="subtracted","explanation missing"); observed,ok:=events[4].(scenarios.ObservationEvent);check(ok && observed.Name=="Actual" && observed.Value==int64(2),"actual observation missing")`)
  }, 120000)
  it('isolates Go observation snapshots from driver observer and cleanup mutation', async () => {
    await sdkProbe(`
given:=map[string][]int{"balance":{5}}; when:=[]int{6}; expected:=[]int{5}
decision:=map[string][]int{"cents":{5}}; afterObserver:=0
s:=scenarios.Scenario[map[string][]int,[]int,[]int]{ID:"snapshot",Name:"isolated",Given:given,When:when,Expect:expected}
d:=scenarios.Driver[map[string][]int,map[string][]int,[]int,[]int]{
 Given:func(ctx context.Context,v map[string][]int)(map[string][]int,error){v["balance"][0]=99;return v,nil},
 When:func(ctx context.Context,subject map[string][]int,v []int)([]int,error){
  v[0]=88;scenarios.Explain(ctx,"first",decision);afterObserver=decision["cents"][0]
  decision["cents"][0]=6;scenarios.Explain(ctx,"second",decision);return subject["balance"],nil
 },
 Cleanup:func(ctx context.Context,subject map[string][]int)error{subject["balance"][0]=44;decision["cents"][0]=44;return nil},
}
events:=[]scenarios.ExecutionEvent{}
ctx=scenarios.WithEvents(ctx,func(event scenarios.ExecutionEvent){
 events=append(events,event)
 if observed,ok:=event.(scenarios.ObservationEvent);ok {
  if observed.Name=="Given" {observed.Value.(map[string]any)["balance"].([]any)[0]=int64(77)}
  if observed.Name=="Expect" {observed.Value.([]any)[0]=int64(66)}
 }
 if explained,ok:=event.(scenarios.ExplanationEvent);ok && explained.Message=="first" {explained.Data.(map[string]any)["cents"].([]any)[0]=int64(77)}
})
actual,err:=scenarios.VerifySpecification(ctx,d,s);var mismatch *scenarios.MismatchError
check(errors.As(err,&mismatch) && reflect.DeepEqual(actual,[]int{99}) && reflect.DeepEqual(mismatch.Expected,[]int{5}),"observer rewrote exact comparison")
check(given["balance"][0]==5 && when[0]==6 && expected[0]==5,"observer or driver rewrote declaration")
check(len(events)==6 && afterObserver==5,"explanation snapshot changed caller payload")
check(events[2].(scenarios.ObservationEvent).Value.([]any)[0]==int64(66),"observer-owned expectation missing")
check(events[3].(scenarios.ExplanationEvent).Data.(map[string]any)["cents"].([]any)[0]==int64(77),"observer-owned explanation missing")
check(events[4].(scenarios.ExplanationEvent).Data.(map[string]any)["cents"].([]any)[0]==int64(6),"cleanup rewrote explanation")
check(events[5].(scenarios.ObservationEvent).Value.([]any)[0]==int64(99),"cleanup rewrote actual snapshot")
plain:=map[string]any{"balance":[]any{int64(5)}}
plainScenario:=scenarios.Scenario[map[string]any,int,int64]{ID:"plain",Name:"already portable",Given:plain,When:0,Expect:5}
plainDriver:=scenarios.Driver[map[string]any,map[string]any,int,int64]{Given:func(ctx context.Context,v map[string]any)(map[string]any,error){return v,nil},When:func(ctx context.Context,v map[string]any,_ int)(int64,error){return v["balance"].([]any)[0].(int64),nil}}
plainContext:=scenarios.WithEvents(context.Background(),func(event scenarios.ExecutionEvent){if observed,ok:=event.(scenarios.ObservationEvent);ok && observed.Name=="Given" {observed.Value.(map[string]any)["balance"].([]any)[0]=int64(99)}})
_,err=scenarios.VerifySpecification(plainContext,plainDriver,plainScenario);check(err==nil && plain["balance"].([]any)[0]==int64(5),"already-portable graph aliased declaration or driver input")
`)
  }, 120000)
  it('preserves exact Go verification outside portable JSON values', async () => {
    await sdkProbe(`
value:=diagnosticValue{Huge:9007199254740993,Number:complex(2,3),Bytes:[]byte{1,2,3},Labels:map[int]string{2:"two",1:"one"}}
s:=scenarios.Scenario[diagnosticValue,int,diagnosticValue]{ID:"portable",Name:"exact",Given:value,When:0,Expect:value}
d:=scenarios.Driver[diagnosticValue,diagnosticValue,int,diagnosticValue]{Given:func(ctx context.Context,v diagnosticValue)(diagnosticValue,error){return v,nil},When:func(ctx context.Context,s diagnosticValue,v int)(diagnosticValue,error){return s,nil}}
events:=[]scenarios.ExecutionEvent{};ctx=scenarios.WithEvents(ctx,func(event scenarios.ExecutionEvent){events=append(events,event)})
actual,err:=scenarios.VerifySpecification(ctx,d,s);check(err==nil && reflect.DeepEqual(actual,value),"nonportable exact verification failed")
texts:=0
for _,event:=range events {if observed,ok:=event.(scenarios.TextObservationEvent);ok {texts++;check(strings.Contains(observed.Text,"9007199254740993") && strings.Contains(observed.Text,"(2+3i)"),"nonportable value lost precision or used JSON")}}
check(texts==3,"nonportable observations did not use text")
encoded,err:=json.Marshal(events);check(err==nil && json.Valid(encoded),"text observations could not cross JSON transport")
events=nil
large:=uint64(9007199254740993)
scalar:=scenarios.Scenario[uint64,int,uint64]{ID:"integer",Name:"exact integer",Given:large,When:0,Expect:large}
scalarDriver:=scenarios.Driver[uint64,uint64,int,uint64]{Given:func(ctx context.Context,v uint64)(uint64,error){return v,nil},When:func(ctx context.Context,v uint64,_ int)(uint64,error){scenarios.Explain(ctx,"large integer",v);return v,nil}}
integer,err:=scenarios.VerifySpecification(ctx,scalarDriver,scalar);check(err==nil && integer==large,"large integer exact verification failed")
check(events[0].(scenarios.TextObservationEvent).Text=="9007199254740993" && events[3].(scenarios.ExplanationEvent).Data=="9007199254740993" && events[4].(scenarios.TextObservationEvent).Text=="9007199254740993","large integer diagnostic lost precision")
encoded,err=json.Marshal(events);check(err==nil && json.Valid(encoded),"large integer events could not cross JSON transport")
`, `type diagnosticValue struct{Huge uint64; Number complex128; Bytes []byte; Labels map[int]string}
func (diagnosticValue) String() string{panic("String must not run")}
func (diagnosticValue) GoString() string{panic("GoString must not run")}`)
  }, 120000)
  it('isolates Go explanations across concurrent executions', async () => {
    await sdkProbe(`s:=scenarios.Scenario[int,int,int]{ID:"isolation",Name:"isolated",Given:0,When:0,Expect:0}; d:=scenarios.Driver[int,int,int,int]{Given:func(ctx context.Context,v int)(int,error){return v,nil},When:func(ctx context.Context,s int,v int)(int,error){scenarios.Explain(ctx,"decision",v);return v,nil}}; streams:=[][]scenarios.ExecutionEvent{make([]scenarios.ExecutionEvent,0),make([]scenarios.ExecutionEvent,0)}; var wait sync.WaitGroup; wait.Add(2); for index:=range streams{go func(index int){defer wait.Done();local:=s;local.When=index;local.Expect=index;execution:=scenarios.WithEvents(ctx,func(event scenarios.ExecutionEvent){streams[index]=append(streams[index],event)});_,err:=scenarios.VerifySpecification(execution,d,local);check(err==nil,"concurrent execution failed")}(index)};wait.Wait();for index,stream:=range streams{check(len(stream)==5,"isolated stream incomplete");explanation:=stream[3].(scenarios.ExplanationEvent);check(explanation.Data==int64(index),"explanations crossed executions")}`)
  }, 120000)
  it('retains Go explanations when exact comparison fails', async () => {
    await sdkProbe(`${simple} s.Expect=9; cleaned:=false; d.When=func(ctx context.Context,s int,v int)(int,error){scenarios.Explain(ctx,"actual decision",map[string]any{"actual":s-v});return s-v,nil};d.Cleanup=func(ctx context.Context,s int)error{cleaned=true;return nil};events:=[]scenarios.ExecutionEvent{};ctx=scenarios.WithEvents(ctx,func(event scenarios.ExecutionEvent){events=append(events,event)});_,err:=scenarios.VerifySpecification(ctx,d,s);check(err!=nil && cleaned,"mismatch or cleanup semantics changed");explanation:=events[3].(scenarios.ExplanationEvent);check(explanation.Message=="actual decision" && len(events)==5,"explanation or actual was lost on failure")`)
  }, 120000)
  it('rejects invalid Go declarations before preparation', async () => {
    await sdkProbe(`
called:=false
s:=scenarios.Scenario[any,int,int]{ID:"bad",Name:"bad",Given:func(){},When:1,Expect:1}
d:=scenarios.Driver[int,any,int,int]{Given:func(ctx context.Context,v any)(int,error){called=true;return 0,nil},When:func(ctx context.Context,s int,v int)(int,error){return v,nil}}
_,err:=scenarios.VerifySpecification(ctx,d,s)
check(err!=nil && !called,"invalid data reached application")
s.Given=1; s.ID=" "
_,err=scenarios.VerifySpecification(ctx,d,s)
check(err!=nil && !called,"invalid identity reached application")
s.ID="duplicate"
suite:=scenarios.Suite[any,int,int]{Driver:scenarios.DriverBinding{Path:"driver.go",Export:"Driver"},Scenarios:[]scenarios.Scenario[any,int,int]{s,s}}
check(scenarios.ValidateSuite(suite)!=nil,"duplicate identities accepted")
`)
  }, 120000)
  it('reports real Go observation mismatches', async () => {
    await sdkProbe(`type Event struct{Cents int}; s:=scenarios.Scenario[int,int,Event]{ID:"amount",Name:"wrong amount",Given:100,When:1,Expect:Event{Cents:100}}; d:=scenarios.Driver[int,int,int,Event]{Given:func(ctx context.Context,v int)(int,error){return v,nil},When:func(ctx context.Context,s int,v int)(Event,error){return Event{Cents:99},nil}}; actual,err:=scenarios.VerifySpecification(ctx,d,s); check(actual.Cents==99 && err!=nil,"wrong observation passed"); var mismatch *scenarios.MismatchError; check(errors.As(err,&mismatch) && mismatch.ScenarioID==s.ID && reflect.DeepEqual(mismatch.Expected,s.Expect) && reflect.DeepEqual(mismatch.Actual,actual),"mismatch lost identity or observations")`)
  }, 120000)
  it('preserves Go declarations against driver mutation', async () => {
    await sdkProbe(`type Data map[string][]int; values:=Data{"balance":{5}}; s:=scenarios.Scenario[Data,Data,Data]{ID:"mutation",Name:"original",Given:values,When:values,Expect:values}; d:=scenarios.Driver[Data,Data,Data,Data]{Given:func(ctx context.Context,v Data)(Data,error){v["balance"][0]=99;return v,nil},When:func(ctx context.Context,s Data,v Data)(Data,error){v["balance"][0]=99;return s,nil}}; _,err:=scenarios.VerifySpecification(ctx,d,s); check(err!=nil && values["balance"][0]==5,"mutation rewrote expectation")`)
  }, 120000)
  it('preserves primary and cleanup failures', async () => {
    await sdkProbe(`${simple} cleanup:=errors.New("cleanup failure"); count:=0; d.Cleanup=func(ctx context.Context,s int)error{count++;return cleanup}; s.Expect=9; _,err:=scenarios.VerifySpecification(ctx,d,s); var mismatch *scenarios.MismatchError; check(errors.Is(err,cleanup) && errors.As(err,&mismatch) && count==1,"primary or cleanup error lost")`)
  }, 120000)
  it('releases prepared resources after cancellation', async () => {
    await sdkProbe(`${simple} ctx,cancel:=context.WithCancel(ctx); cleaned:=false; d.When=func(ctx context.Context,s int,v int)(int,error){cancel();return 0,ctx.Err()}; d.Cleanup=func(ctx context.Context,s int)error{cleaned=ctx.Err()==nil;return nil}; _,err:=scenarios.VerifySpecification(ctx,d,s); check(errors.Is(err,context.Canceled) && cleaned,"cancelled subject was not cleaned")`)
  }, 120000)
  it('inspects Go scenarios without running initializers', async () => {
    const root = await project()
    await put(root, 'specifications/driver.go', driver('return subject-value,nil', 'func init(){os.WriteFile("initialized",[]byte("bad"),0600)}'))
    const list = cli(root, 'list'); passed(list)
    const line = source().split('\n').findIndex(value => value.includes('ID:"account"')) + 1
    expect(JSON.parse(list.stdout).scenarios).toEqual(expect.arrayContaining([{ id: 'account', name: 'bank observation', scope: 'current', source: { path: suitePath, line }, evidence: [{ reference: `scenarios-go::${encodeSelector(suitePath, 'account')}`, source: { path: suitePath, line } }] }]))
    passed(cli(root, 'show', 'account'))
    passed(cli(root, 'validate', '--strict'))
    await expect(stat(join(root, 'initialized'))).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(stat(join(root, 'actions'))).rejects.toMatchObject({ code: 'ENOENT' })
  }, 120000)
  it('rejects dynamic Go scenarios without evaluation', async () => {
    const root = await project()
    await put(root, suitePath, source().replace('ID:"account"', 'ID:danger()'))
    const result = cli(root, 'list')
    expect(result.status).toBe(1)
    expect(result.stdout).toMatch(/literal|unsupported|dynamic/u)
    await expect(stat(join(root, 'actions'))).rejects.toMatchObject({ code: 'ENOENT' })
    for (const content of [source().replace('Expect:0', ''), source(['same', 'same']), source().replace('Given:5,', 'Given:5,Given:6,')]) {
      await expect(readCatalog(suitePath, content)).rejects.toThrow()
    }
  }, 120000)
  it('executes native Go scenarios without a registry', async () => {
    const root = await project()
    const id = 'Opaque Δ / :: " ID'
    await put(root, suitePath, source([id]))
    const inventory = cli(root, 'show', id); passed(inventory)
    const item = JSON.parse(inventory.stdout).scenarios[0] as {evidence:{reference:string}[]}
    expect(decodeSelector(item.evidence[0]!.reference.slice('scenarios-go::'.length))).toEqual([suitePath, id])
    const result = cli(root, 'run', '--scenario', id); passed(result)
    expect(JSON.parse(result.stdout)).toMatchObject({ scenarios: [{ id, status: 'PASS' }] })
    await expect(stat(join(root, '.focused-spec/evidence.yaml'))).rejects.toMatchObject({ code: 'ENOENT' })
  }, 120000)
  it('executes only the exact selected Go identity', async () => {
    const root = await project()
    const id = 'Exact Δ :: / "'
    await put(root, suitePath, source([id, 'must-not-run']))
    const selector = encodeSelector(suitePath, id)
    const one = await runner.resolve({ ...context(root), selectors: [selector] })
    const two = await runner.resolve({ ...context(root), selectors: [selector] })
    expect(one.errors).toEqual([])
    expect(two.targets[0]?.targetId).toBe(one.targets[0]?.targetId)
    const result = await runner.run({ ...context(root), targets: one.targets })
    expect(result.results).toMatchObject([{ status: 'pass' }])
    expect(await readFile(join(root, 'actions'), 'utf8')).toBe('5\n')
    expect((await readdir(root)).filter(name => name.startsWith('focused-scenario-'))).toEqual([])
  }, 120000)
  it('retains direct Go runner events when bank verification fails', async () => {
    const root = await bankProject()
    await put(root, 'specifications/account.driver.go', `package specifications
import("context"; "example.com/scenario-bank/bank"; scenarios "${sdkModule}")
var AccountDriver = scenarios.Driver[*bank.Account,[]bank.Event,bank.Command,[]bank.Event]{
 Given:func(ctx context.Context,history []bank.Event)(*bank.Account,error){return bank.From(history)},
 When:func(ctx context.Context,account *bank.Account,command bank.Command)([]bank.Event,error){
  actual,err:=account.Handle(command,func(message string,data any){scenarios.Explain(ctx,message,data)})
  for index:=range actual {if actual[index].Type=="WithdrawalDeclined" {actual[index].Reason="wrong-reason"}}
  return actual,err
 },
}`)
    const resolved = await runner.resolve({ ...context(root), selectors: [encodeSelector('specifications/account.scenarios.go', 'account.withdraw.insufficient-funds')] })
    expect(resolved.errors).toEqual([])
    const result = await runner.run({ ...context(root), targets: resolved.targets })
    expect(result.results).toEqual([expect.objectContaining({
      status: 'fail', diagnostic: expect.stringContaining('wrong-reason'),
      events: expect.arrayContaining([
        { kind: 'observation', message: 'Given', data: { value: [{type:'AccountOpened',cents:0,reason:''},{type:'MoneyDeposited',cents:5000,reason:''},{type:'MoneyWithdrawn',cents:2000,reason:''}] } },
        { kind: 'explanation', message: expect.any(String), data: {requestedCents:4000,availableCents:3000,decision:'declined'} },
        { kind: 'observation', message: 'Actual', data: { value: [{type:'WithdrawalDeclined',cents:4000,reason:'wrong-reason'}] } },
      ]),
    })])
    const actionRoot = await project()
    await put(actionRoot, 'specifications/driver.go', driver('scenarios.Explain(ctx,"action attempted",map[string]any{"requested":value}); return 0,os.ErrInvalid'))
    const actionResolved = await runner.resolve({ ...context(actionRoot), selectors: [encodeSelector(suitePath, 'account')] })
    expect(actionResolved.errors).toEqual([])
    const actionResult = await runner.run({ ...context(actionRoot), targets: actionResolved.targets })
    expect(actionResult.results[0]).toMatchObject({ status: 'fail', diagnostic: expect.stringContaining('action failed') })
    expect(actionResult.results[0]?.events).toEqual([
      { kind: 'observation', message: 'Given', data: { value: 5 } },
      { kind: 'observation', message: 'When', data: { value: 5 } },
      { kind: 'observation', message: 'Expect', data: { value: 0 } },
      { kind: 'explanation', message: 'action attempted', data: { requested: 5 } },
    ])
  }, 120000)
  it('rejects a removed Go target', async () => {
    const root = await project()
    const resolved = await runner.resolve({ ...context(root), selectors: [encodeSelector(suitePath, 'account')] })
    expect(resolved.errors).toEqual([])
    await put(root, suitePath, source(['replacement']))
    const result = await runner.run({ ...context(root), targets: resolved.targets })
    expect(result.results).toMatchObject([{ status: 'fail', diagnostic: expect.stringContaining('not found') }])
    await expect(stat(join(root, 'actions'))).rejects.toMatchObject({ code: 'ENOENT' })
  }, 120000)
  it('rejects a missing selected execution report', async () => {
    for (const action of ['os.Exit(0); return 0,nil', 'os.WriteFile(os.Args[1],[]byte("invalid report"),0600); os.Exit(0); return 0,nil']) {
      const root = await project()
      await put(root, 'specifications/driver.go', driver(action))
      const result = cli(root, 'run', '--scenario', 'account')
      expect(result.status).toBe(1)
      expect(JSON.parse(result.stdout)).toMatchObject({ scenarios: [{ status: 'FAIL' }] })
      expect(result.stdout).toMatch(/report/u)
    }
  }, 120000)
  it('rejects escaped Go driver sources without execution', async () => {
    const root = await project()
    const outside = join(temporary, 'outside.go')
    await writeFile(outside, driver('panic("escaped execution")'))
    await rm(join(root, 'specifications/driver.go'))
    await symlink(outside, join(root, 'specifications/driver.go'))
    const resolved = await runner.resolve({ ...context(root), selectors: [encodeSelector(suitePath, 'account')] })
    expect(resolved.targets).toEqual([])
    expect(resolved.errors[0]?.message).toContain('escapes the project')
    await expect(stat(join(root, 'actions'))).rejects.toMatchObject({ code: 'ENOENT' })
  }, 120000)
  it('cancels a running Go application and cleans bridge resources', async () => {
    const root = await project()
    await put(root, 'specifications/driver.go', driver('<-ctx.Done(); return 0,ctx.Err()').replace(
      ' Given:func',
      ' Cleanup:func(ctx context.Context,subject int)error{return os.WriteFile("cleaned",[]byte("released"),0600)},\n Given:func',
    ))
    const controller = new AbortController()
    const resolved = await runner.resolve({ ...context(root), selectors: [encodeSelector(suitePath, 'account')] })
    expect(resolved.errors).toEqual([])
    const operation = runner.run({ ...context(root, controller.signal), targets: resolved.targets }).then(
      () => 'resolved', error => error instanceof Error ? error.name : String(error),
    )
    try {
      const deadline = Date.now() + 60000
      while (true) {
        try { await stat(join(root, 'actions')); break } catch (error) {
          if (Date.now() > deadline) throw error
          await delay(20)
        }
      }
    } finally { controller.abort() }
    expect(await operation).toBe('AbortError')
    expect(await readFile(join(root, 'cleaned'), 'utf8')).toBe('released')
    expect((await readdir(root)).filter(name => name.startsWith('focused-scenario-'))).toEqual([])
  }, 120000)
  it('explains the actual Go bank withdrawal decision', async () => {
    const root = await bankProject()
    const demo = command(root, 'go', ['run', './cmd/demo'])
    passed(demo)
    expect(demo.stdout).toContain('"requestedCents":4000')
    expect(demo.stdout).toContain('"availableCents":3000')
    expect(demo.stdout).toContain('"decision":"declined"')
  }, 120000)
  it('roundtrips canonical Go bank messages through the application codec', async () => {
    const root = await bankProject()
    const result = command(root, 'go', ['test', './specifications', '-run', '^TestAccountMessageRoundtrips$'])
    passed(result)
    const codec = join(root, 'bank/messages.go')
    const original = await readFile(codec, 'utf8')
    for (const [find, replacement, diagnostic] of [
      ['func EncodeCommand(command Command) ([]byte, error) {', 'func EncodeCommand(command Command) ([]byte, error) { command.Cents = 0', 'account.deposit When[0]'],
      ['func EncodeEvent(event Event) ([]byte, error) {', 'func EncodeEvent(event Event) ([]byte, error) { if event.Type == "MoneyWithdrawn" && event.Cents == 2000 { event.Cents = 0 }', 'account.withdraw.history Given[3]'],
      ['func EncodeEvent(event Event) ([]byte, error) {', 'func EncodeEvent(event Event) ([]byte, error) { if event.Type == "WithdrawalDeclined" && event.Cents == 4000 { event.Cents = 0 }', 'account.withdraw.insufficient-funds Expect[0]'],
    ] as const) {
      await writeFile(codec, original.replace(find, replacement))
      const broken = command(root, 'go', ['test', './specifications', '-run', '^TestAccountMessageRoundtrips$'])
      expect(broken.status, broken.stdout + broken.stderr).toBe(1)
      expect(broken.stdout + broken.stderr).toContain(diagnostic)
    }
    await writeFile(codec, original)
    const demo = command(root, 'go', ['run', './cmd/demo'])
    passed(demo)
    expect(demo.stdout).toContain('Message roundtrip: PASS')
  }, 120000)
  it('checks Go serialization without executing or rewriting bank scenarios', async () => {
    const root = await bankProject()
    const suite = join(root, 'specifications/account.scenarios.go')
    const before = await readFile(suite, 'utf8')
    const account = join(root, 'bank/account.go')
    const application = await readFile(account, 'utf8')
    await writeFile(account, application.replace('func (a *Account) Handle(command Command, explain Explain) ([]Event, error) {', 'func (a *Account) Handle(command Command, explain Explain) ([]Event, error) { panic("business execution reached serialization check")'))
    const result = command(root, 'go', ['test', './specifications', '-run', '^TestAccountMessageRoundtrips$'])
    passed(result)
    expect(await readFile(suite, 'utf8')).toBe(before)
    await expect(stat(join(root, 'node_modules'))).rejects.toMatchObject({ code: 'ENOENT' })
  }, 120000)
  it('detects a lost Go decline reason independently of bank behavior', async () => {
    const root = await bankProject()
    const codec = join(root, 'bank/messages.go')
    const baseline = await readFile(codec, 'utf8')
    const changed = baseline.replace('Reason: wire.Reason}', 'Reason: ""}')
    expect(changed).not.toBe(baseline)
    await writeFile(codec, changed)
    const serialization = command(root, 'go', ['test', './specifications', '-run', '^TestAccountMessageRoundtrips$'])
    expect(serialization.status).toBe(1)
    expect(serialization.stdout + serialization.stderr).toContain('account.withdraw.insufficient-funds Expect[0]')
    const demo = command(root, 'go', ['run', './cmd/demo'])
    expect(demo.status).toBe(1)
    expect(demo.stdout + demo.stderr).toContain('Message roundtrip: FAIL')
    const business = command(root, 'go', ['test', './specifications', '-run', '^TestAccountScenarios$'])
    passed(business)
  }, 120000)
  it('exposes the real Go bank execution across standalone detailed and JSON output', async () => {
    const root = await bankProject(true)
    const id = 'account.withdraw.insufficient-funds'
    const demo = command(root, 'go', ['run', './cmd/demo'])
    passed(demo)
    for (const fragment of ['GIVEN', 'WHEN', 'EXPECT', 'EXPLAIN', 'ACTUAL', '"requestedCents":4000', '"availableCents":3000', 'insufficient-funds']) expect(demo.stdout).toContain(fragment)
    const executable = join(root, 'node_modules/focused-spec/dist/cli.js')
    const detailed = command(root, process.execPath, [executable, 'run', '--scenario', id, '--details'])
    passed(detailed)
    expect(detailed.stdout).toContain('declined')
    expect(detailed.stdout).toContain('requestedCents')
    expect(detailed.stdout).toContain('availableCents')
    const json = cli(root, 'run', '--scenario', id)
    passed(json)
    const scenario = JSON.parse(json.stdout).scenarios[0]
    expect(scenario).toMatchObject({ id, status: 'PASS' })
    expect(scenario.evidence[0].events).toEqual(expect.arrayContaining([
      { kind: 'explanation', message: expect.any(String), data: { requestedCents: 4000, availableCents: 3000, decision: 'declined' } },
      { kind: 'observation', message: 'Actual', data: { value: [{ type: 'WithdrawalDeclined', cents: 4000, reason: 'insufficient-funds' }] } },
    ]))
    const combined = cli(root, 'run', '--scenario', id, '--details')
    passed(combined)
    expect(JSON.parse(combined.stdout).scenarios).toEqual(JSON.parse(json.stdout).scenarios)
  }, 180000)
  it('runs distributed Go assets outside the checkout', async () => {
    const root = await mkdtemp(join(temporary, 'consumer-'))
    await cp(join(repository, 'examples/scenarios/go'), root, { recursive: true, filter: path => !path.includes('node_modules') })
    await cp(join(repository, 'packages/sdk/go'), join(root, 'sdk'), { recursive: true })
    await put(root, 'go.mod', `module example.com/scenario-bank\n\ngo 1.23\nrequire ${sdkModule} v0.0.0\nreplace ${sdkModule} => ./sdk\n`)
    await put(root, 'package.json', '{"name":"packed-go-bank","private":true,"type":"module"}')
    passed(command(root, 'npm', ['install', '--ignore-scripts', '--prefer-offline', '--no-audit', '--no-fund', ...tarballs.values()]))
    passed(command(root, 'go', ['test', './...']))
    const demo = command(root, 'go', ['run', './cmd/demo']); passed(demo)
    for (const args of [['list'], ['show', 'account.withdraw.entire-balance'], ['validate', '--syntax-only'], ['validate', '--strict'], ['run', '--scenario', 'account.withdraw.entire-balance'], ['run']]) passed(cli(root, ...args))
    for (const name of ['@focused-spec/format-scenarios-go', '@focused-spec/runner-scenarios-go']) {
      const docs = cli(root, 'plugin-docs', '--package', name); passed(docs)
      expect(JSON.parse(docs.stdout).selection).toEqual({ kind: 'package', name })
    }
  }, 180000)
  it('detects the Go bank withdrawal boundary regression', async () => {
    const root = await mkdtemp(join(temporary, 'bank-regression-'))
    await cp(join(repository, 'examples/scenarios/go'), root, { recursive: true, filter: path => !path.includes('node_modules') })
    await put(root, 'go.mod', `module example.com/scenario-bank\n\ngo 1.23\nrequire ${sdkModule} v0.0.0\nreplace ${sdkModule} => ${join(repository, 'packages/sdk/go')}\n`)
    await symlink(join(repository, 'node_modules'), join(root, 'node_modules'), 'dir')
    const path = join(root, 'bank/account.go')
    const baseline = await readFile(path, 'utf8')
    const ordinary = () => command(root, 'go', ['test', './...'])
    const focused = () => cli(root, 'run', '--scenario', 'account.withdraw.entire-balance')
    const baselineRuns = () => { for (const result of [ordinary(), command(root, 'go', ['run', './cmd/demo']), focused(), cli(root, 'run')]) passed(result) }
    baselineRuns()
    try {
      const changed = baseline.replace('command.Cents > a.balance', 'command.Cents >= a.balance')
      expect(changed).not.toBe(baseline)
      await writeFile(path, changed)
      const failed = ordinary()
      expect(failed.status).toBe(1)
      expect(failed.stdout).toContain('MoneyWithdrawn')
      const failedDemo = command(root, 'go', ['run', './cmd/demo'])
      expect(failedDemo.status).toBe(1)
      expect(failedDemo.stdout + failedDemo.stderr).toContain('MoneyWithdrawn')
      const all = cli(root, 'run')
      expect(all.status).toBe(1)
      expect(JSON.parse(all.stdout).scenarios).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'account.withdraw.entire-balance', status: 'FAIL' })]))
      const selected = focused()
      expect(selected.status).toBe(1)
      expect(JSON.parse(selected.stdout)).toMatchObject({ scenarios: [{ id: 'account.withdraw.entire-balance', status: 'FAIL' }] })
      expect(selected.stdout).toContain('MoneyWithdrawn')
    } finally { await writeFile(path, baseline) }
    baselineRuns()
  }, 180000)
})
