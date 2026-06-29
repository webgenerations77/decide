import { Platform } from 'react-native';
import Constants from 'expo-constants';

function getApiBase() {
  if (Platform.OS === 'web') return '';
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) return `http://${hostUri.split(':')[0]}:8081`;
  return 'http://localhost:8081';
}

// Posts feedback to /api/feedback. Resolves to { success } or { success:false, error }.
export async function submitFeedback({ page, feedbackType, message, rating, userEmail, userName }) {
  try {
    const res = await fetch(`${getApiBase()}/api/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        page, feedbackType, message,
        rating: rating || null,
        userEmail, userName,
        timestamp: new Date().toISOString(),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || `Failed (${res.status})` };
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}
