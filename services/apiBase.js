import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Web build talks to same-origin Vercel functions; native dev talks to the Expo dev host.
export function getApiBase() {
  if (Platform.OS === 'web') return '';
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const host = hostUri.split(':')[0];
    return `http://${host}:8081`;
  }
  return 'http://localhost:8081';
}
