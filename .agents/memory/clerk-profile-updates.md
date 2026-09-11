---
name: Clerk profile updates in Expo
description: Non-obvious compatibility details for editing Clerk names and uploading Expo-selected profile images.
---

For Expo profile editing, pass only populated name fields to Clerk and upload a local ImagePicker asset using the native `{ uri, name, type }` file shape before calling `user.setProfileImage`.

**Why:** Empty/null name fields and raw device URIs can be rejected by Clerk's profile endpoints even though the TypeScript API accepts them; React Native multipart uploads need the native file descriptor.

**How to apply:** Keep image selection and conversion inside the same guarded async flow, use the Expo ImagePicker media type string supported by the installed SDK, and rely on Clerk's update response rather than an extra `user.reload()` call.