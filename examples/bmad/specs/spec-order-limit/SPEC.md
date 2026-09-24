---
id: SPEC-order-limit
companions:
  - focused-spec.md
sources: []
---

# Order Item Limit

## Why

Shoppers need an order to stop accepting new line items at its configured limit so checkout workloads stay within the capacity promised by the service.

## Capabilities

- **CAP-1**
  - **intent:** The order service can decide whether an order may accept one more line item.
  - **success:** An order already containing as many line items as its configured limit is denied another item.

## Constraints

- The decision uses the current line-item count, not item quantities; reaching the configured limit is sufficient to deny another item.

## Non-goals

- This spec does not reserve inventory, price items, or change the configured limit.

## Success signal

- At the limit boundary, the product decision rejects another line item and the linked focused evidence passes against that behavior.
