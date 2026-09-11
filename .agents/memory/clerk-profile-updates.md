---
name: Clerk profile updates in Expo
description: Non-obvious compatibility details for editing Clerk names and uploading Expo-selected profile images.
---

For Expo profile editing, update names and images through authenticated server routes using Clerk's backend client; direct Expo Go image uploads through Clerk `FormData` are not supported.

**Why:** The managed mobile Frontend API rejected the SDK's `first_name` parameter for this app, and direct Clerk image uploads failed with `Unsupported FormDataPart implementation`; the backend SDK accepts the image as a normal Blob.

**How to apply:** Keep image selection inside the guarded async flow, send the selected image as binary data to the authenticated API, and treat local Clerk resource refresh as best effort after the server update.