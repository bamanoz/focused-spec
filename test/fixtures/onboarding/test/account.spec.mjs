import { describe, expect, it } from 'vitest'
import { deposit } from '../src/account.mjs'

describe('account', () => {
  it('deposits funds', () => expect(deposit(100, 25)).toBe(125))
})
