# Error fallback validation

The fallback is intentionally rendered outside the app providers, so these checks
must be performed without wrapping it in `ThemeProvider`, `AuthProvider`, or a
safe-area context:

1. Trigger a render error before the provider tree mounts. Confirm that the
   fallback shows "Something went wrong" and the "Try Again" action.
2. Trigger a render error from a screen below `ThemeProvider`. Confirm that the
   same fallback appears instead of a second `useTheme` error.
3. In development, open the alert/details action and confirm that the original
   error message and stack are visible.
4. Press "Try Again" and confirm that the app reloads (or the boundary resets
   when a native reload is unavailable).

The fallback uses only React Native primitives, Expo reload support, and static
colors. It must not import `useColors`, `useTheme`, `useSafeAreaInsets`, or any
authenticated provider.