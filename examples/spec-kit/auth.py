def login_allowed(*, credentials_valid: bool, account_blocked: bool) -> bool:
    """Return whether an account may start an authenticated session."""
    return credentials_valid and not account_blocked
