// Optional node:test integration for `npm test`, demonstrating standalone SDK use.
// Scenarios live only in specifications/account.scenarios.mjs; this wrapper checks both
// in-memory business execution and the consumer-owned message codec.
// Neither `npm start` nor the focused-spec scenario runner uses this file.

import { deepStrictEqual } from 'node:assert/strict';
import { test } from 'node:test';
import { verifySpecification } from '@focused-spec/scenarios-typescript';
import accountDriver from '../specifications/account.driver.mjs';
import suite from '../specifications/account.scenarios.mjs';
import { verifySerialization } from '../serialization.mjs';
import { decodeMessage, encodeMessage } from '../src/messages.mjs';

test('canonical bank messages roundtrip through the application codec', () => {
  const before = structuredClone(suite.scenarios);
  const visited = [];
  const checked = verifySerialization(suite, {
    encodeMessage(message) {
      visited.push(structuredClone(message));
      return encodeMessage(message);
    },
    decodeMessage,
  });
  const canonical = suite.scenarios.flatMap(scenario => [...scenario.given, scenario.when, ...scenario.expect]);
  deepStrictEqual(visited, canonical);
  deepStrictEqual(checked, canonical.length);
  deepStrictEqual(suite.scenarios, before);
});

for (const scenario of suite.scenarios) {
  test(scenario.name, () => verifySpecification(accountDriver, scenario));
}
