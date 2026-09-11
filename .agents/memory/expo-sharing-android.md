---
name: Android Expo file sharing
description: Android Expo Go sharing requires a readable content URI for locally generated files.
---

On Android, pass a `content://` URI to Expo Sharing when sharing a locally generated file; a private `file://` URI can fail with “Not allowed to read file under given URL.”

**Why:** Expo Go's Android sharing provider cannot grant another app access to the app-private file URI directly.

**How to apply:** For a local file URI, wrap it with the Expo FileSystem `File` API and use `new File(uri).contentUri` on Android before calling `Sharing.shareAsync`; keep the original URI for iOS.