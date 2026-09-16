---
name: Native Android build prerequisites
description: Requirements and validation limits for compiling the custom Android notification listener.
---

Native Android validation requires a Java runtime and a configured Android SDK with a valid `ANDROID_HOME` or `android/local.properties`; installing Java alone is not enough.

**Why:** The workspace initially lacked Java, and after Java was made available Gradle stopped at missing Android SDK configuration before compiling the app.

**How to apply:** Before running the mobile Gradle tasks, check both `java -version` and the Android SDK location. If the SDK is unavailable, validate TypeScript, Metro, API integration, and native source registration, then defer APK/device acceptance to an Android-capable environment.