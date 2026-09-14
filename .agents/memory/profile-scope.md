---
name: Financial profile scope
description: The app supports personal and business financial profiles with safe server-side ownership checks.
---

Financial rows keep their Clerk owner, an explicit nullable profileId for schema/backfill compatibility, and a composite scoped owner during the transition from account-only data. The API resolves the requested profile from authenticated ownership before any financial route runs; never trust a client profile id without that membership check.

**Why:** Existing tables had no migration framework and were keyed only by Clerk userId, so a first-access backfill had to preserve existing rows while preventing profile data leakage.

**How to apply:** New financial endpoints must use the resolved scoped owner/profile context, populate profileId on inserts, and account deletion must remove all composite-scoped rows and profile records.