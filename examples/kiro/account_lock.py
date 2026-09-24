from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class AccountAccess:
    consecutive_failed_sign_ins: int = 0
    locked: bool = False


def record_failed_sign_in(
    state: AccountAccess, *, lock_threshold: int = 5
) -> AccountAccess:
    if lock_threshold < 1:
        raise ValueError("lock_threshold must be positive")
    if state.locked:
        return state

    failed_sign_ins = state.consecutive_failed_sign_ins + 1
    return AccountAccess(
        consecutive_failed_sign_ins=failed_sign_ins,
        locked=failed_sign_ins >= lock_threshold,
    )
