---
name: Expo static build port
description: Environment constraint affecting static Expo exports when the mockup preview is running
---

The static Expo build script probes and downloads from Metro on port 8081, while the mockup preview workflow can already occupy that port.

**Why:** Running the mobile static build with the mockup workflow active makes Expo enter an interactive “use another port?” prompt; in non-interactive mode the build times out even when the app's normal Expo workflow bundles successfully.

**How to apply:** Treat a normal Expo workflow bundle and typecheck as valid app verification when this collision is present; if a static export is required, free port 8081 before invoking the existing mobile build script.