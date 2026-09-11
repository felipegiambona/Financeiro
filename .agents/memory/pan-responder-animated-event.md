---
name: PanResponder and Animated events
description: React Native 0.86 behavior when combining PanResponder callbacks with Animated.event.
---

React Native 0.86 can return an `AnimatedEvent` object from `Animated.event` when native driving is enabled; `PanResponder` expects `onPanResponderMove` to be a callable function, so the combination can crash with `Object is not a function`.

**Why:** The native event object is intended for components that attach animated events, not for the direct callback contract used by `PanResponder`.

**How to apply:** Use an explicit `onPanResponderMove` callback for `PanResponder`, update the animated value there with bounds, and reserve the native driver for the release/snap animation. Use Gesture Handler plus Reanimated instead if a fully UI-thread-driven gesture is required.