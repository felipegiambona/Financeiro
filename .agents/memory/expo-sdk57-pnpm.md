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

Expo SDK 57 uses edge-to-edge system bars. Configure icon contrast declaratively with `StatusBar` and `NavigationBar`, and let the app's root background extend behind both bars; older navigation-bar background APIs and app-config fields are no longer supported.

**Why:** The SDK 57 type definitions removed the imperative navigation-bar color/button methods and the Expo config schema rejects the old Android navigation-bar and edge-to-edge fields.

**How to apply:** Use a full-screen root with the app background color, `StatusBar` with light icons for a dark theme, and `NavigationBar` with `style="light"` for light system icons. Mirror that style plus disabled contrast enforcement in the plugin so Expo Go receives it through the manifest.

Changes to system-bar settings delivered through the Expo Go manifest require closing the project and reopening it; Fast Refresh alone can preserve the previous colors.

**Why:** The corrected dark system bars were confirmed on a physical Android device only after reopening the project in Expo Go.

**How to apply:** After changing app configuration or navigation-bar plugin options, restart the Expo workflow and retest from a fresh project open in Expo Go.

The mobile static-export helper probes and starts Metro on `localhost:8081`, so it cannot run while the mockup-sandbox workflow owns that port.

**Why:** The helper does not expose a port override and exits when Expo asks to move to another port.

**How to apply:** Treat an export failure at the interactive port prompt as an environment conflict; free port 8081 before retrying rather than changing application code.