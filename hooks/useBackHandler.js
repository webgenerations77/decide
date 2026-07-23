import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { backStack } from '../lib/nav/backStack';

// Web-only: while `active`, register a dismissible layer so the browser/hardware
// back button calls `onDismiss` (LIFO across all active layers). No-op on native,
// where RN Modals already handle hardware back via onRequestClose.
// The effect keys on `active` only; the ref keeps `onDismiss` fresh without
// re-registering the layer on every render (callers pass fresh closures).
export function useBackHandler(active, onDismiss) {
  const cb = useRef(onDismiss);
  cb.current = onDismiss;
  useEffect(() => {
    if (Platform.OS !== 'web' || !backStack || !active) return;
    const id = backStack.push(() => cb.current());
    return () => backStack.remove(id);
  }, [active]);
}
