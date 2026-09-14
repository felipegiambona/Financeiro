---
name: Onboarding state recovery
description: Local onboarding persistence must distinguish incomplete setup from profile data that failed to load.
---

The onboarding gate must not interpret an empty wallet list as a new profile when the wallet request failed. Existing profiles with a wallet can also carry stale local `started` steps from an interrupted or older build; recover those states per profile instead of reopening the initial personal steps.

**Why:** Profile switching remounts all profile-scoped providers, so a transient request failure or stale AsyncStorage flag can otherwise replace the dashboard with onboarding and make healthy profile data appear missing.

**How to apply:** Keep onboarding storage keyed by both authenticated user and financial profile, gate new-profile decisions on a successful wallet load, and only auto-recover steps that are invalid for an already initialized profile; preserve later steps when a real onboarding is still in progress.