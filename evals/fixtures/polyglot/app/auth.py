def authenticate(blocked: bool, credentials_valid: bool) -> bool:
    return credentials_valid and not blocked
