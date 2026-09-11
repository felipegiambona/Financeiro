---
name: Clerk profile updates in Expo
description: Non-obvious compatibility details for editing Clerk names and uploading Expo-selected profile images.
---

For Expo profile editing, update names through the authenticated server route using Clerk's backend client, while uploading a local ImagePicker asset using the native `{ uri, name, type }` file shape through `user.setProfileImage`.

**Why:** The managed mobile Frontend API rejected the SDK's `first_name` parameter for this app, while the backend Clerk client supports the profile update; React Native multipart uploads still need the native file descriptor.

**How to apply:** Keep image selection and conversion inside the same guarded async flow, use the Expo ImagePicker media type string supported by the installed SDK, and treat local Clerk resource refresh as best effort after the server update.