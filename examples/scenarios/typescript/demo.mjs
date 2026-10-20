import { verifySpecification } from '@focused-spec/scenarios-typescript';
import accountDriver from './specifications/account.driver.mjs';
import suite from './specifications/account.scenarios.mjs';
import { verifySerialization } from './serialization.mjs';

const MAX_EVENTS = 256;
const MAX_EVENT_BYTES = 65_536;
const truncation = { kind: 'truncated', message: 'Additional execution events were not retained' };


function createCollector() {
  const events = [];
  let truncated = false;
  let bytes = 2;
  const markerBytes = Buffer.byteLength(JSON.stringify(truncation)) + 1;
  return {
    events,
    emit(event) {
      if (truncated) return;
      const size = Buffer.byteLength(JSON.stringify(event)) + (events.length === 0 ? 0 : 1);
      if (events.length >= MAX_EVENTS - 1 || bytes + size + markerBytes > MAX_EVENT_BYTES) {
        events.push(truncation);
        truncated = true;
        return;
      }
      events.push(event);
      bytes += size;
    },
  };
}

function render(event) {
  if (event.kind === 'observation') {
    console.log(`  ${event.name.toUpperCase().padEnd(7)}`, 'value' in event ? JSON.stringify(event.value) : event.text);
  } else if (event.kind === 'explanation') {
    console.log('  EXPLAIN', event.message, event.data === undefined ? '' : JSON.stringify(event.data));
  } else {
    console.log('  TRUNCATED', event.message);
  }
}

let failed = 0;
for (const scenario of suite.scenarios) {
  console.log(`\n${scenario.name}`);
  const collector = createCollector();
  let failure;
  try {
    await verifySpecification(accountDriver, scenario, { onEvent: collector.emit });
  } catch (error) {
    failure = error;
  }
  for (const event of collector.events) render(event);
  if (failure === undefined) {
    console.log('  PASS');
  } else {
    failed += 1;
    console.error('  FAIL', failure);
  }
}

let serializationFailed = false;
try {
  const checked = verifySerialization(suite);
  console.log(`\nSerialization roundtrip: PASS (${checked} messages)`);
} catch (error) {
  serializationFailed = true;
  console.error('\nSerialization roundtrip: FAIL', error);
}

console.log(`${suite.scenarios.length - failed} passed, ${failed} failed`);
process.exitCode = failed === 0 && !serializationFailed ? 0 : 1;
