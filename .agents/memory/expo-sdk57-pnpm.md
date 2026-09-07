---
name: Expo SDK 57 in pnpm workspace
description: Peer-resolution and optional DevTools behavior specific to Expo SDK 57 in this pnpm workspace.
---

Keep peer-sensitive React dependencies resolved from the mobile package's React 19.2 installation rather than the workspace's older React catalog entry. Keep the React Native Metro config available directly when pnpm reports the React Native 0.86 and Worklets peer as missing, and preserve the direct Metro runtime unless a clean Expo bundle proves it unnecessary.

**Why:** Expo Doctor detected duplicate React native-module installations when React Query resolved against the workspace's React 19.1 catalog. React Native 0.86 and Worklets also reported a missing Metro config peer under pnpm.

**How to apply:** After Expo dependency alignment, run Expo's dependency check and Doctor from the mobile package, then export both native targets. Pin only the affected package locally instead of upgrading unrelated workspace artifacts.

The optional React Native DevTools desktop shell may report missing Linux desktop libraries in the Nix environment even while Metro, Expo Go manifests, native exports, and web preview work.

**Why:** Installing one missing shared library exposed another desktop-shell dependency; this error belongs to the optional debugger executable, not the app bundle.

**How to apply:** Treat it as non-blocking only when Metro stays running, the SDK manifest is served, exports pass, and the app preview loads. Do not confuse it with a runtime or bundling failure.