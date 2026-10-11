from app.notifications import should_deliver


def test_disabled_delivery() -> None:
    assert should_deliver(enabled=False) is False
