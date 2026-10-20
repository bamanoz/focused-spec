export function safeText(value: string): string {
  return value.replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, character => `\\u${character.codePointAt(0)!.toString(16).padStart(4, '0')}`)
}
