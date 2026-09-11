---
name: Android Expo file sharing
description: Android Expo Go sharing requires a readable content URI for locally generated files.
---

On Android, pass a `content://` URI to Expo Sharing when sharing a locally generated file; a private `file://` URI can fail with “Not allowed to read file under given URL.” In Expo Go, use the legacy `getContentUriAsync` helper rather than relying on the newer `File.contentUri` property.

**Why:** Expo Go's Android sharing provider cannot grant another app access to the app-private file URI directly, and the newer File API may require a read permission that is not available for generated cache files.

**How to apply:** For a local file URI, call `FileSystem.getContentUriAsync(uri)` on Android before calling `Sharing.shareAsync`; keep the original URI for iOS.