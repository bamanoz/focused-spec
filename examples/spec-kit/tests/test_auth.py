from auth import login_allowed


def test_blocked_account() -> None:
    assert login_allowed(credentials_valid=True, account_blocked=True) is False
