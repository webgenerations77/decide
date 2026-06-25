import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#00191f' },
        animation: 'slide_from_right',
      }}
    />
  );
}
