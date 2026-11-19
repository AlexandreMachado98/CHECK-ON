import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colors } from '../components/ui';
import { AppProvider, useApp } from '../lib/app-state';

function RootStack() {
  const { ready, user } = useApp();
  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '700' },
        contentStyle: { backgroundColor: colors.background },
        headerBackButtonDisplayMode: 'minimal',
      }}
    >
      {/* Sem login, só a tela de entrada existe. */}
      <Stack.Protected guard={!user}>
        <Stack.Screen name="login" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={!!user}>
        <Stack.Screen name="index" options={{ title: 'CHECK-ON' }} />
        <Stack.Screen name="vehicles" options={{ title: 'Escolher veículo' }} />
        <Stack.Screen name="scan" options={{ title: 'Ler QR Code', headerShown: false }} />
        <Stack.Screen name="vehicle/[id]" options={{ title: 'Veículo' }} />
        <Stack.Screen name="inspection" options={{ title: 'Inspeção', gestureEnabled: false }} />
        <Stack.Screen name="done" options={{ title: 'Inspeção concluída', headerBackVisible: false, gestureEnabled: false }} />
        <Stack.Screen name="queue" options={{ title: 'Envios' }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <StatusBar style="dark" />
        <RootStack />
      </AppProvider>
    </SafeAreaProvider>
  );
}
