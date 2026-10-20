import { Account } from '../src/account.mjs';

// This account lives entirely in memory; it owns no external resources to clean up.
export default {
  given: history => Account.from(history),
  when: (account, command, context) => account.handle(command, context.explain),
};
