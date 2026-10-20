import { deepStrictEqual } from 'node:assert/strict';
import { decodeMessage, encodeMessage } from './src/messages.mjs';

const defaultCodec = { encodeMessage, decodeMessage };

function roundtrip(scenario, section, index, message, codec) {
  const original = structuredClone(message);
  const input = structuredClone(message);
  let decoded;
  try {
    decoded = codec.decodeMessage(codec.encodeMessage(input));
  } catch (cause) {
    throw new Error(`${scenario.id} ${section}[${index}] could not be roundtripped`, { cause });
  }
  deepStrictEqual(decoded, original, `${scenario.id} ${section}[${index}] changed during roundtrip`);
  deepStrictEqual(message, original, `${scenario.id} ${section}[${index}] was mutated during serialization`);
}

export function verifySerialization(suite, codec = defaultCodec) {
  let checked = 0;
  for (const scenario of suite.scenarios) {
    for (const [index, message] of scenario.given.entries()) {
      roundtrip(scenario, 'Given', index, message, codec);
      checked += 1;
    }
    roundtrip(scenario, 'When', 0, scenario.when, codec);
    checked += 1;
    for (const [index, message] of scenario.expect.entries()) {
      roundtrip(scenario, 'Expect', index, message, codec);
      checked += 1;
    }
  }
  return checked;
}
