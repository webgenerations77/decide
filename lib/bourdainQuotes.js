// Anthony Bourdain quotes shown beneath the DECIDE button, in place of the old
// "Cheddar-curated, based on where you are" line. The quote advances once per app
// launch: a persisted pointer increments on the first read of each JS session, so
// successive opens rotate through the list in order (then wrap).
import AsyncStorage from '@react-native-async-storage/async-storage';

export const BOURDAIN_QUOTES = [
  "Your body is not a temple, it's an amusement park. Enjoy the ride.",
  'Good food is very often, even most often, simple food.',
  "Context and memory play powerful roles in all the truly great meals in one's life.",
  "Skills can be taught. Character you either have or you don't have.",
  'Open your mind, get up off the couch, move.',
  'Travel changes you. It leaves marks on your memory, your consciousness.',
  'The journey is part of the experience — an expression of the seriousness of one’s intent.',
  'Food is everything we are.',
  'Maybe that’s enlightenment enough: to know there is no final resting place of the mind.',
  "I don't have to agree with you to like you or respect you.",
];

export const QUOTE_ATTRIBUTION = 'Anthony Bourdain';

const KEY = '@decide/quote_index';
let resolved = null;   // index chosen for THIS app launch (null until first read)
let pending  = null;   // in-flight resolve promise (dedupes concurrent callers)

// Advance to the next quote once per app launch. Idempotent within a JS session.
export function pickLaunchQuote() {
  if (resolved !== null) return Promise.resolve(BOURDAIN_QUOTES[resolved]);
  if (!pending) {
    pending = (async () => {
      let prev = parseInt((await AsyncStorage.getItem(KEY)) ?? '-1', 10);
      if (!Number.isFinite(prev)) prev = -1;
      resolved = (prev + 1) % BOURDAIN_QUOTES.length;
      try { await AsyncStorage.setItem(KEY, String(resolved)); } catch {}
      return BOURDAIN_QUOTES[resolved];
    })();
  }
  return pending;
}

// Synchronous value for first render: this launch's quote once resolved, else the first.
export function currentQuote() {
  return BOURDAIN_QUOTES[resolved ?? 0];
}
