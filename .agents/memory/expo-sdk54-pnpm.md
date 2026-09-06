---
name: Expo SDK 54 in pnpm workspace
description: Expo SDK 54 needs a direct Metro runtime dependency in this workspace so the managed Metro bundler can resolve it.
---

Expo SDK 54 can report `Cannot find module metro-runtime/package.json` when the Metro runtime is only transitive under pnpm. Keep the compatible `metro-runtime` package as a direct app dependency.

**Why:** The Expo CLI resolves Metro from the app package context, while pnpm does not expose every transitive dependency at that level.

**How to apply:** After aligning an Expo artifact to SDK 54, run the Expo compatibility check, keep the direct Metro runtime dependency, restart the managed workflow, and inspect logs before presenting the app.