---
name: Investment schema alignment
description: The API investment quote fields can be ahead of the integration database schema during staged schema work.
---

The integration database may still expose the older `finance_investments` columns while the checked-in Drizzle schema and API expect quote-related fields.

**Why:** Investment quote work can land in application code before the development database is synchronized, causing unrelated authenticated integration tests and API typechecks to fail.

**How to apply:** When validating unrelated financial cleanup, use only columns confirmed by the live integration table for direct fixtures and report quote-column failures separately; synchronize the database before testing quote behavior.