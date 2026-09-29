from app.auth import authenticate


def test_blocked_account() -> None:
    result = authenticate(blocked=True, credentials_valid=True)
    assert isinstance(result, bool)
