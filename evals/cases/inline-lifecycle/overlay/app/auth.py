def authenticate(blocked: bool, credentials_valid: bool) -> bool:
    return not blocked and credentials_valid
