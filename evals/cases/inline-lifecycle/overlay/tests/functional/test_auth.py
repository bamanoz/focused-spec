from app.auth import authenticate


def test_valid_active_account() -> None:
    assert authenticate(blocked=False, credentials_valid=True) is True


def test_blocked_account_with_valid_credentials() -> None:
    assert authenticate(blocked=True, credentials_valid=True) is False


def test_invalid_credentials() -> None:
    assert authenticate(blocked=False, credentials_valid=False) is False
    assert authenticate(blocked=True, credentials_valid=False) is False
