from account_lock import AccountAccess, record_failed_sign_in


def test_account_locks_at_failure_threshold() -> None:
    state = AccountAccess()

    for _ in range(4):
        state = record_failed_sign_in(state)

    assert state.locked is False

    state = record_failed_sign_in(state)

    assert state.consecutive_failed_sign_ins == 5
    assert state.locked is True
