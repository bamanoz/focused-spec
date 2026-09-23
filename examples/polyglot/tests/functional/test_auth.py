def test_blocked_account() -> None:
    credentials_valid = True
    blocked = True

    allowed = credentials_valid and not blocked

    assert allowed is False
