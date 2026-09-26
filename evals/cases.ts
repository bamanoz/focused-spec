import type { EvalCase } from './types.ts'
import { OPEN_SPEC_SKILLS } from './types.ts'

const FOCUSED = ['focused-spec'] as const
const ALL_SKILLS = [...FOCUSED, ...OPEN_SPEC_SKILLS]
const EXPECTED_SELECTORS = ['TestBlockedAccount', 'test_blocked_account'] as const

export const EVAL_CASES: readonly EvalCase[] = [
  {
    id: 'files-source-bootstrap',
    description: 'Creates a declarative focused spec in an explicit current scope with two project runners in a clean polyglot repository.',
    source: 'files',
    turns: [{ promptPath: 'cases/files-source-bootstrap/prompt.md', skills: FOCUSED }],
    expectedScenarioId: 'auth.login.blocked-account',
    expectedEvidenceCount: 2,
    expectedSelectorFragments: EXPECTED_SELECTORS,
  },
  {
    id: 'openspec-apply',
    description: 'Applies an existing OpenSpec change and replaces planned Go and pytest evidence.',
    overlay: 'cases/openspec-apply/overlay',
    source: 'openspec',
    changeName: 'add-blocked-account-focused-spec',
    turns: [{
      promptPath: 'cases/openspec-apply/prompt.md',
      skills: ['focused-spec', 'openspec-apply-change'],
    }],
    expectedScenarioId: 'auth.login.blocked-account',
    expectedEvidenceCount: 2,
    expectedSelectorFragments: EXPECTED_SELECTORS,
  },
  {
    id: 'openspec-brownfield',
    description: 'Adopts focused-spec in the main spec produced by a bare OpenSpec apply/sync/archive of blocked-account behavior.',
    source: 'openspec',
    overlay: 'cases/openspec-brownfield/overlay',
    changeName: 'link-blocked-auth-evidence',
    turns: [{
      promptPath: 'cases/openspec-brownfield/prompt.md',
      skills: ['focused-spec', 'openspec-apply-change', 'openspec-sync-specs'],
    }],
    expectedScenarioId: 'auth.login.blocked-account',
    expectedEvidenceCount: 2,
    expectedSelectorFragments: ['TestBlockedAccountWithValidCredentials', 'test_blocked_account_with_valid_credentials'],
  },
  {
    id: 'openspec-propose-apply',
    description: 'Creates a proposal, respects the planning boundary, then applies it in a fresh agent session.',
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
    expectedScenarioId: 'auth.login.blocked-account',
    expectedEvidenceCount: 2,
    expectedSelectorFragments: EXPECTED_SELECTORS,
  },
  {
    id: 'full-skill-routing',
    description: 'Selects the correct proposal and apply workflows while every OpenSpec skill is available.',
    source: 'openspec',
    changeName: 'add-blocked-account-focused-spec',
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
    expectedScenarioId: 'auth.login.blocked-account',
    expectedEvidenceCount: 1,
    maximumEvidenceCount: 2,
    expectedSelectorFragments: [],
    expectedSelectorAlternatives: ['::./auth::TestBlockedAccount', '::tests/functional/test_auth.py::test_blocked_account'],
  },
]

export function evalCase(id: string): EvalCase | undefined {
  return EVAL_CASES.find(candidate => candidate.id === id)
}
