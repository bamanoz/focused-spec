def can_add_item(current_item_count: int, item_limit: int) -> bool:
    """Return whether an order has room for one more line item."""
    return current_item_count < item_limit
