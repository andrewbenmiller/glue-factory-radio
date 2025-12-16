import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Shows' }} />
      <Stack.Screen name="show/[id]" options={{ title: 'Show Details' }} />
    </Stack>
  );
}

