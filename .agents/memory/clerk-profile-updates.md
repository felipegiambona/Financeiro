---
name: Clerk profile updates in Expo
description: Non-obvious compatibility details for editing Clerk names and uploading Expo-selected profile images.
---

For Expo profile editing, update names and images through authenticated server routes using Clerk's backend client; direct Expo Go image uploads through Clerk `FormData` are not supported.

**Why:** The managed mobile Frontend API rejected the SDK's `first_name` parameter for this app, direct Clerk image uploads failed with `Unsupported FormDataPart implementation`, and Expo Go could not read the local picker URI with `fetch`; the backend SDK accepts the reconstructed image Blob.

**How to apply:** Enable ImagePicker base64 output, send the selected image data as JSON to the authenticated API, reconstruct the Blob on the server, and treat local Clerk resource refresh as best effort after the server update.