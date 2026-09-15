---
name: API route test bundling
description: Bundling API route tests that import Express and database-backed modules.
---

HTTP route tests that import the API server route module should keep CommonJS-heavy server dependencies external or replace unused database clients with a test stub when producing an ESM bundle.

**Why:** esbuild's bundled ESM output cannot execute dynamic `require` calls from Express and PostgreSQL dependencies, and the package does not expose every transitive database dependency from the test's resolution path.

**How to apply:** Run the bundled test from the API package so external Express resolves from its local dependencies; alias an unused database client such as `pg` to a no-op test stub when the tested handler does not access the database.