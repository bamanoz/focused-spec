import { describe, expect, it } from 'vitest'
import { renderJUnit } from '../packages/core/src/junit.js'

describe('JUnit report values', () => {
  it('replaces XML-invalid code points while preserving supplementary characters and escaping metacharacters', () => {
    const result = renderJUnit({ success: true, targetCount: 0, scenarios: [{
      scope: 'current', id: 'xml', name: 'before\u0000\u000b\ud800x\udfff\ufffe\uffff<&>"\'😀after',
      source: { path: 'spec.md', line: 1 }, status: 'PASS', evidence: [],
    }] })
    expect(result).toContain('name="before���x���&lt;&amp;&gt;&quot;&apos;😀after"')
  })
})
