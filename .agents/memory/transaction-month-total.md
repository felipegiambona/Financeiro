---
name: Transaction month totals
description: Business rule for the total shown at the bottom of the transactions screen.
---

The total at the bottom of the transactions screen represents all financial items displayed for the selected month. When card invoices are shown alongside the transaction list, their amounts must be included in that total; card-linked transactions themselves must not be added again.

**Why:** Card purchases are intentionally excluded from ordinary transaction arithmetic and represented by the invoice summary, so omitting that summary makes the displayed total incomplete.

**How to apply:** Keep the total aligned with the visible invoice section and active month/type/date conditions. Add each displayed invoice once, and keep transfer-only views independent from invoice totals.