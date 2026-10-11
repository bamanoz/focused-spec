## REMOVED Requirements

### Requirement: Sharded checked-transition continuity
**Reason**: The checked-transition CLI/API and its immutable snapshots are removed; physical sharding does not need a separate lifecycle protocol.
**Migration**: Keep explicit surviving scope-local registrations in configured domain shards and use ordinary native-binding validation and selected evidence execution after the host-owned operation. Ordinary source safety, scope-local uniqueness, diagnostic provenance and AND evidence remain unchanged.
