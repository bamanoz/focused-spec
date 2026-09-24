from order_limit import can_add_item


def test_order_at_limit_rejects_another_item() -> None:
    assert can_add_item(current_item_count=3, item_limit=3) is False
