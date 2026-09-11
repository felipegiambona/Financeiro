---
name: Android Expo file sharing
description: Android Expo Go sharing requires a readable content URI for locally generated files.
---

On Android with Expo SDK 57, pass the original `file://` URI to Expo Sharing and store generated files under `documentDirectory`; `content://` URIs are rejected and cache paths may fail the provider's read check.

**Why:** The Expo Sharing module creates its own FileProvider URI, only accepts local file URLs, and its Android permission service reliably recognizes the app document directory.

**How to apply:** Write the file under `FileSystem.documentDirectory` and call `Sharing.shareAsync(uri)` with that `file://` URI. Use the native print sheet on Android when PDF-to-file generation fails in Expo Go.