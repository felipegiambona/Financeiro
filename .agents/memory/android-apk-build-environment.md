---
name: Android APK build environment
description: Workspace-specific constraints for compiling the native Android app.
---

Native Android builds in this workspace require an official Android SDK with the project’s compile/build tools plus NDK and CMake packages, and they are reliable with OpenJDK 17 rather than the default GraalVM JDK. For a phone-installable debug APK, build only `arm64-v8a` with one Gradle worker and a reduced heap.

**Why:** The default environment initially lacked an SDK, GraalVM crashed in `jlink`/performance counters, and unrestricted native compilation could make the Gradle daemon disappear.

**How to apply:** Install or point `ANDROID_HOME`/`ANDROID_SDK_ROOT` at the SDK, set `JAVA_HOME` to OpenJDK 17, disable JVM perf data, and use the arm64/low-concurrency Gradle options when producing an APK.