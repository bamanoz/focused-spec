from __future__ import annotations

from collections.abc import Callable, Mapping, Sequence
from typing import Any


Explanation = Callable[[str, Mapping[str, int]], None]


class Account:
    """In-memory event-sourced account; commands emit only new events."""

    def __init__(self) -> None:
        self._opened = False
        self._balance = 0

    @classmethod
    def from_history(cls, history: Sequence[Mapping[str, Any]]) -> Account:
        account = cls()
        for event in history:
            account._apply(event)
        return account

    def handle(self, command: Mapping[str, Any], explain: Explanation) -> list[dict[str, Any]]:
        kind = command.get("type")
        if kind == "OpenAccount":
            if self._opened:
                raise ValueError("Account is already open")
            event: dict[str, Any] = {"type": "AccountOpened"}
        else:
            if not self._opened:
                raise ValueError("Account is not open")
            if kind not in {"DepositMoney", "WithdrawMoney"}:
                raise ValueError(f"Unknown command: {kind}")
            cents = command.get("cents")
            if type(cents) is not int or cents <= 0:
                raise ValueError("Amount must be a positive integer in cents")
            if kind == "DepositMoney":
                if self._balance + cents > 2**53 - 1:
                    raise ValueError("Balance exceeds the supported amount")
                event = {"type": "MoneyDeposited", "cents": cents}
            elif cents > self._balance:
                event = {"type": "WithdrawalDeclined", "cents": cents, "reason": "insufficient-funds"}
                explain("Withdrawal declined", {"requestedCents": cents, "availableCents": self._balance})
            else:
                event = {"type": "MoneyWithdrawn", "cents": cents}
                explain("Withdrawal allowed", {"requestedCents": cents, "availableCents": self._balance})
        self._apply(event)
        return [event]

    def _apply(self, event: Mapping[str, Any]) -> None:
        kind = event.get("type")
        if kind == "AccountOpened":
            self._opened = True
        elif kind == "MoneyDeposited":
            self._balance += event["cents"]
        elif kind == "MoneyWithdrawn":
            self._balance -= event["cents"]
        elif kind == "WithdrawalDeclined":
            return
        else:
            raise ValueError(f"Unknown event: {kind}")
