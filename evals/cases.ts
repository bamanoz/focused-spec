import type { EvalCase } from './types.ts'
import { OPEN_SPEC_SKILLS } from './types.ts'

const FOCUSED = ['focused-spec'] as const
const ALL_SKILLS = [...FOCUSED, ...OPEN_SPEC_SKILLS]
const EXPECTED_SELECTORS = ['TestBlockedAccount', 'test_blocked_account'] as const

export const EVAL_CASES: readonly EvalCase[] = [
  {
    id: 'files-source-bootstrap',
    description: 'Creates a marked native specification with scope-local registry evidence and two project runners in a clean polyglot repository.',
    source: 'files',
    turns: [{ promptPath: 'cases/files-source-bootstrap/prompt.md', skills: FOCUSED }],
    expectedEvidenceCount: 2,
    expectedSelectorFragments: EXPECTED_SELECTORS,
  },
  {
    id: 'vacuous-evidence',
    description: 'Changes Python authentication while repairing existing falsely green registry evidence and proving its sensitivity.',
    source: 'files',
    overlay: 'cases/vacuous-evidence/overlay',
    turns: [{ promptPath: 'cases/vacuous-evidence/prompt.md', skills: FOCUSED }],
    editablePaths: ['app/auth.py', 'tests/functional/test_auth.py'],
    prescribedScenarioId: 'auth.login.blocked-account',
    expectedEvidenceCount: 1,
    expectedSelectorFragments: ['tests/functional/test_auth.py::test_blocked_account'],
    expectedSelectorAlternatives: ['pytest-functional::tests/functional/test_auth.py::test_blocked_account'],
  },
  {
    id: 'openspec-apply',
    description: 'Applies an existing OpenSpec change and binds native behavior to executable Go and pytest evidence.',
    overlay: 'cases/openspec-apply/overlay',
    source: 'openspec',
    changeName: 'add-blocked-account-focused-spec',
    turns: [{
      promptPath: 'cases/openspec-apply/prompt.md',
      skills: ['focused-spec', 'openspec-apply-change'],
    }],
    prescribedScenarioId: 'auth.login.blocked-account',
    expectedEvidenceCount: 2,
    expectedSelectorFragments: EXPECTED_SELECTORS,
  },
  {
    id: 'openspec-brownfield',
    description: 'Adopts focused-spec registry evidence in the main native spec produced by an OpenSpec apply/sync/archive workflow.',
    source: 'openspec',
    overlay: 'cases/openspec-brownfield/overlay',
    changeName: 'link-blocked-auth-evidence',
    turns: [{
      promptPath: 'cases/openspec-brownfield/prompt.md',
      skills: ['focused-spec', 'openspec-apply-change'],
      checkpoint: 'working-evidence',
    }, {
      promptPath: 'cases/openspec-brownfield/sync.md',
      skills: ['focused-spec', 'openspec-sync-specs'],
    }],
    prescribedScenarioId: 'auth.login.blocked-account',
    expectedEvidenceCount: 2,
    expectedSelectorFragments: ['TestBlockedAccountWithValidCredentials', 'test_blocked_account_with_valid_credentials'],
  },
  {
    id: 'openspec-propose-apply',
    description: 'Creates a native-marker proposal, respects the planning boundary, then applies it with registry evidence in a fresh agent session.',
    source: 'openspec',
    changeName: 'add-blocked-account-focused-spec',
    turns: [
      {
        promptPath: 'cases/openspec-propose-apply/propose.md',
        skills: ['focused-spec', 'openspec-propose'],
        checkpoint: 'proposal',
      },
      {
        promptPath: 'cases/openspec-propose-apply/apply.md',
        skills: ['focused-spec', 'openspec-apply-change'],
      },
    ],
    expectedEvidenceCount: 2,
    expectedSelectorFragments: EXPECTED_SELECTORS,
  },
  {
    id: 'full-skill-routing',
    description: 'Selects the correct proposal and apply workflows while every OpenSpec skill is available for native authoring.',
    source: 'openspec',
    changeName: 'reject-blocked-login',
    turns: [
      {
        promptPath: 'cases/full-skill-routing/propose.md',
        skills: ALL_SKILLS,
        checkpoint: 'proposal',
      },
      {
        promptPath: 'cases/full-skill-routing/apply.md',
        skills: ALL_SKILLS,
      },
    ],
    expectedEvidenceCount: 1,
    maximumEvidenceCount: 2,
    expectedSelectorFragments: [],
    expectedSelectorAlternatives: ['::TestBlockedAccount', '/TestBlockedAccount', '::tests/functional/test_auth.py::test_blocked_account'],
  },
]

export function evalCase(id: string): EvalCase | undefined {
  return EVAL_CASES.find(candidate => candidate.id === id)
}
