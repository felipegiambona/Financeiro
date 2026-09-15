---
name: Expo component test bundling
description: Constraints for running isolated Expo component tests through the workspace Node runner.
---

Provider-free Expo component tests can run under Node when native modules are replaced with small local mocks, while `react` and `react-dom/server` remain external and the generated bundle is written beside the package's `node_modules`.

**Why:** Bundling `react-dom/server` into an ESM test triggers a dynamic `require("util")` failure, and writing an externalized bundle under `/tmp` prevents Node from resolving the package-local React dependencies.

**How to apply:** Use esbuild aliases for `react-native`, Expo modules, and icon modules; externalize `react` and `react-dom/server`; generate a temporary bundle inside the mobile package and remove it with an exit trap.