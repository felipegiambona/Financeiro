---
name: Linked receipt idempotency
description: Concurrency rules for financial records that create or maintain a linked transaction.
---

When a financial record can create a linked transaction, lock the source row inside the same database transaction before checking or changing the link. Reuse the existing linked row when it still exists; recreate it only when the link points to a manually deleted transaction.

**Why:** Repeated taps, reloads, or concurrent requests can otherwise all observe a missing link and create duplicate financial entries.

**How to apply:** Use a row lock for receipt-like state changes, derive editable fields from the locked row, and leave historical transactions unlinked when the source record is deleted.