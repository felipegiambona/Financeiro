---
name: Expo Go notifications
description: Compatibility boundary between Expo Go and expo-notifications on Android.
---

`expo-notifications` Android notification APIs are not available inside Expo Go from SDK 53 onward. The mobile app must skip notification setup and scheduling when running in Expo Go, while keeping the feature enabled in a development build or standalone native build.

**Why:** Calling notification setup from the shared app tree makes Expo Go fail before Expo Router mounts, producing misleading missing-route and `ErrorBoundary` errors.

**How to apply:** Detect `ExecutionEnvironment.StoreClient` from `expo-constants` before calling notification APIs. Treat the absence of notifications in Expo Go as intentional; validate actual alerts with a development build or standalone APK.