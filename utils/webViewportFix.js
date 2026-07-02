// Web-only viewport/scroll fixes, injected at runtime.
//
// This app builds with web.output: "single" (SPA), where Expo Router ignores app/+html.js,
// so we can't customize the document <head> that way — we inject a <style> at bootstrap.
// The app mounts to <div id="root"> and the default react-native-web reset already sets
// `body { overflow: hidden }` so RN <ScrollView>s own scrolling.
//
// Two mobile-web problems this fixes:
//
// 1. Overscroll / rubber-band ("keeps scrolling after the bottom button"): mobile browsers
//    apply elastic overscroll + scroll-chaining to the scrollable element. `body{overflow:hidden}`
//    does NOT stop it because the real scroller is the inner RN-web ScrollView <div>, not the body.
//    `overscroll-behavior: none` stops the bounce/chaining — applied to html/body/#root AND every
//    element under #root (`#root *`) so it reaches whichever div is the scroller. It's a no-op on
//    non-scrolling elements, so the broad selector is safe.
//
// 2. Dynamic viewport height: `height: 100%` resolves against the large viewport (URL bar hidden),
//    so `100dvh` (tracks the visible viewport) keeps the app sized to what's actually on screen.
//    Guarded by @supports so the 100% fallback is untouched on older browsers.

import { Platform } from 'react-native';

if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const STYLE_ID = 'decide-web-viewport-fix';
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent =
      'html,body,#root{overscroll-behavior:none;}' +
      '#root *{overscroll-behavior:none;}' +
      '@supports (height:100dvh){html,body,#root{height:100dvh;}}';
    document.head.appendChild(style);
  }
}
