---
name: Expo web preview loading
description: A web-only blank preview caused by blocking the root layout on ClerkLoaded.
---

The Expo app should render its provider tree while Clerk initializes. The AuthProvider already exposes a loading state and renders a visible loading screen, so wrapping the whole app in ClerkLoaded can leave the browser with an empty root when Clerk's web initialization is delayed.

**Why:** The Replit Expo web preview mounted React but stayed entirely blank without browser errors until the ClerkLoaded gate was removed.

**How to apply:** Keep the ClerkProvider, but let the app render beneath it; use the existing AuthProvider loading state instead of a second top-level ClerkLoaded gate. On web, do not block the root solely on custom font loading either.