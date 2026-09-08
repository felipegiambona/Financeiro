---
name: Authenticated integration environment
description: Durable constraints for Clerk-backed API integration checks and workspace-wide builds.
---

Clerk test identities should use short, unique email local parts; long generated prefixes can exceed the provider's email-address validation limit.

**Why:** The Clerk API rejected otherwise valid temporary addresses when the generated local part was too long, while short unique addresses worked.

**How to apply:** Keep test email prefixes compact and clean up the temporary Clerk users, sessions, and account-owned data in a guaranteed teardown.

Artifact builds may require the `PORT` and `BASE_PATH` values supplied by the artifact workflow; a bare workspace build can fail before reaching the changed package.

**Why:** Managed artifact workflows inject these values, but a shell-level recursive build does not.

**How to apply:** Prefer package-scoped validation for the changed artifact, or provide the same artifact environment when exercising the whole workspace build.