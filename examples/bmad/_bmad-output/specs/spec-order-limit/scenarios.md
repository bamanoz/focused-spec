# Order item limit scenarios

#### Scenario: Order at its item limit rejects another item
- **ID**: `order.limit.reject-at-capacity`
- **EVIDENCE**: `pytest-functional::tests/test_order_limit.py::test_order_at_limit_rejects_another_item`
- **WHEN** an order already has the configured maximum number of line items
- **THEN** the product rejects adding another item
