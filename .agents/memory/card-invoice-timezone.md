---
name: Card invoice timezone
description: Business-date handling for credit card invoice closing and status.
---

Credit card invoice status and closing dates must be calculated using the `America/Sao_Paulo` calendar. The API process runs in UTC, so its calendar day can advance before the user's local day.

**Why:** At the start of a UTC day, São Paulo can still be on the previous day. Using `Date#getDate()` directly marked invoices closed before the configured local closing day.

**How to apply:** Keep backend invoice month/status calculations and the card details screen's current invoice month aligned to `America/Sao_Paulo`; add a boundary test whenever this logic changes.