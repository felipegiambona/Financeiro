---
name: Calendar date API contracts
description: Prevent date-only financial fields from shifting when API schemas coerce them to timestamps.
---

Date-only financial values such as transaction dates, due dates, invoice dates, and card-history dates must remain `YYYY-MM-DD` at API boundaries. If a generated schema coerces the response to `Date`, validate the value at São Paulo noon and serialize it back to a São Paulo calendar-date key before sending JSON.

**Why:** A value such as `2026-08-01` coerced to midnight UTC becomes `2026-07-31 21:00` in `America/Sao_Paulo`, so the mobile history displayed 31/07 for a purchase entered on 01/08.

**How to apply:** Keep transport values date-only where possible. When a schema requires a timestamp, use `T12:00:00-03:00` during validation and normalize the parsed value back with the São Paulo date-key helper.