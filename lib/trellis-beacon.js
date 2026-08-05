// Trellis beacon — reports app load on startup
// Never fails silently; never blocks app initialization

const BEACON_PROJECT_ID = 'decide';
const BEACON_TOKEN = '095af4394d715ebdc9f1bccf33490bcf9361';
const BEACON_URL = 'https://beacon.trellis.dev/beacon_reports';

export function initTrellis() {
  try {
    // Fire and forget — don't await this
    reportBeacon();
  } catch {
    // Silent failure — app continues regardless
  }
}

async function reportBeacon() {
  try {
    const payload = {
      project: BEACON_PROJECT_ID,
      token: BEACON_TOKEN,
      timestamp: new Date().toISOString(),
    };

    const response = await fetch(BEACON_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    // Swallow all response outcomes silently
    if (response.ok) {
      // Success — nothing to do
    }
  } catch {
    // Network error, timeout, JSON error, etc. — all silent
  }
}
