---
name: Onboarding wallet detection
description: Constraint for keeping first-access onboarding detectable for accounts without a wallet
---

Read-only wallet and transaction endpoints must not create a default wallet. The first wallet must be created from the onboarding input and become the user's default.

**Why:** Automatic creation during initial provider loads made every new account appear configured, so the onboarding screen was skipped.

**How to apply:** Keep default-wallet creation limited to operations that need a wallet for a write. If a legacy automatic placeholder exists, the onboarding flow should reuse it instead of creating a duplicate.