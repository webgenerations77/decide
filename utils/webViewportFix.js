// Dynamic-viewport-height fix for mobile web.
//
// This app builds with web.output: "single" (SPA), where Expo Router ignores app/+html.js,
// so we can't customize the document <head> that way. The default react-native-web reset
// sizes html/body/#root with `height: 100%`. Mobile browsers resolve `100%` against the
// *large* viewport (the height with the URL bar hidden), so while the URL bar is showing,
// the scroll container is taller than the visible screen — letting you scroll a little past
// the last element (reported on the beta guide: "keeps scrolling after the bottom button").
//
// `100dvh` (dynamic viewport height) tracks the visible viewport as the URL bar collapses/
// expands, removing that extra scroll. We inject it at runtime, after the default reset, so
// it wins where supported; `@supports` leaves the `100%` fallback untouched on older browsers.
// On desktop there is no dynamic toolbar, so `100dvh` == the full window height (no change).

import { Platform } from 'react-native';

if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const STYLE_ID = 'decide-dvh-fix';
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = '@supports (height: 100dvh){html,body,#root{height:100dvh;}}';
    document.head.appendChild(style);
  }
}
