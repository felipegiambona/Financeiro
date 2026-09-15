---
name: Forecast overdue invoices
description: Business rule for monthly forecast values when card invoices remain unpaid.
---

The forecast for the current month includes unpaid overdue card invoices from prior months, in addition to the current month's invoice. Historical months keep the invoice in their original competence and must not receive the overdue amount again.

**Why:** An unpaid past invoice is still a pending financial obligation. Leaving it only in its historical month makes the current forecast look higher than the amount that still needs to be paid.

**How to apply:** When changing forecast calculations, add prior-month invoices with `overdue` status only to the current-month forecast; exclude paid invoices and avoid adding them to non-current months.

The transactions screen must refresh card summaries when it regains focus, because transaction mutations can change invoice totals while the card context remains mounted.

Dashboard monthly expenses and payable totals also include prior-month overdue invoices that remain unpaid, while paid invoices stay excluded from payable totals.