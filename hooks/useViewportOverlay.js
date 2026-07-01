import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

// Shared fix for RN Modal overlays on mobile web. RN's Modal doesn't pin its content to the
// visible viewport, so transparent overlays drift out of view (open at the top of a tall page,
// or drift under pinch-zoom/scroll). See memory project-web-modal-viewport-fix.
//
// Usage:
//   const overlayRef = useViewportOverlay(visible);
//   <Modal transparent animationType="fade" ...>          // NOT "slide" — see note below
//     <View ref={overlayRef} style={styles.overlay}>...   // overlay style spreads WEB_OVERLAY_FIX
//
// animationType MUST be "fade" (or "none"): "slide" puts a transform on the Modal wrapper, and a
// position:fixed element with a transformed ancestor is trapped by that ancestor, not the viewport.

// Web: fix the overlay to the viewport with explicit 100% dims (Yoga won't derive a height from
// top/bottom insets, so justifyContent would otherwise no-op) + touchAction:'none' to stop scroll
// bleed-through. Native: keep flex:1.
export const WEB_OVERLAY_FIX = Platform.OS === 'web'
  ? { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', touchAction: 'none' }
  : { flex: 1 };

// Returns a ref to attach to the overlay View. On web it glues the overlay to the VISUAL viewport
// (the actual zoomed/scrolled window) via window.visualViewport so the sheet stays exactly over
// what the user sees at any zoom/scroll. No-op on native.
export default function useViewportOverlay(visible) {
  const overlayRef = useRef(null);
  useEffect(() => {
    if (Platform.OS !== 'web' || !visible) return;
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    const el = overlayRef.current;
    if (!vv || !el || !el.style) return;
    const sync = () => {
      el.style.width = `${vv.width}px`;
      el.style.height = `${vv.height}px`;
      el.style.transform = `translate(${vv.offsetLeft}px, ${vv.offsetTop}px)`;
    };
    sync();
    vv.addEventListener('resize', sync);
    vv.addEventListener('scroll', sync);
    return () => {
      vv.removeEventListener('resize', sync);
      vv.removeEventListener('scroll', sync);
    };
  }, [visible]);
  return overlayRef;
}
