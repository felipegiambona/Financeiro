---
name: Wallet brand assets
description: Official wallet logos are supplied as local SVG/PNG assets and rendered without external URLs.
---

Use user-provided official bank logos as local app assets, while preserving the existing wallet icon enum so previously saved wallets remain compatible.

**Why:** External image/logo search may be unavailable or unstable, and approximate logos do not satisfy the product requirement for exact bank marks.

**How to apply:** Add new institution assets under the mobile app's wallet-logo asset directory and extend the shared wallet icon renderer; keep the neutral generic icon for unnamed wallets.