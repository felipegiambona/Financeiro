---
name: Goal movement model
description: How direct goal adjustments differ from linked financial transactions.
---

Direct inclusions and withdrawals from a goal are persisted as goal movements, while expenses and incomes linked from the transaction form remain financial transactions in the goal history.

**Why:** Direct goal actions should update goal progress and history without silently changing wallet balances; linked income and expense entries must continue to affect the financial ledger.

**How to apply:** Keep both sources in goal detail history and include paid linked transactions plus manual movement deltas when calculating the saved amount.