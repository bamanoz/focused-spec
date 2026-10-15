## Context

The current account-authentication specification stores an executable scenario ID and evidence directly in Markdown through the official inline format. Unrelated historical native scenarios remain in their separate plain history document.

## Decisions

- Carry the exact existing opaque ID and both exact evidence references through the working occurrence and published main occurrence.
- Keep inline Markdown as the storage representation; do not introduce a YAML evidence registry.
- Execute the selected working occurrence before publication and the selected main occurrence afterward.
- Preserve every unrelated historical native scenario byte-for-byte.
