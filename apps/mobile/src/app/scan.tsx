import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, colors, styles } from '../components/ui';
import { useApp } from '../lib/app-state';
import { findVehicleByQr } from '../lib/rules';

export default function ScanScreen() {
  const { bootstrap } = useApp();
  const [permission, requestPermission] = useCameraPermissions();
  const [message, setMessage] = useState<string | null>(null);
  const [torch, setTorch] = useState(false);
  const handled = useRef(false);

  function onScanned(data: string) {
    if (handled.current) return;
    // Procura no que já está no celular: funciona sem internet.
    const vehicle = findVehicleByQr(bootstrap?.vehicles ?? [], data);
    if (!vehicle) {
      setMessage('Este QR Code não é de um veículo ativo da sua empresa. Se o veículo for novo, puxe a tela inicial para baixo para atualizar os dados.');
      return;
    }
    handled.current = true;
    router.replace({ pathname: '/vehicle/[id]', params: { id: vehicle.id } });
  }

  if (!permission) return <View style={styles.screen} />;

  if (!permission.granted) {
    return (
      <SafeAreaView style={[styles.screen, { padding: 24, justifyContent: 'center', gap: 16 }]}>
        <Text style={styles.title}>Acesso à câmera</Text>
        <Text style={styles.text}>Para ler o QR Code do veículo, o CHECK-ON precisa usar a câmera.</Text>
        {permission.canAskAgain ? (
          <Button title="Permitir câmera" onPress={requestPermission} />
        ) : (
          <Button title="Abrir configurações" onPress={() => Linking.openSettings()} />
        )}
        <Button variant="outline" title="Escolher na lista" onPress={() => router.replace('/vehicles')} />
      </SafeAreaView>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={torch}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={({ data }) => onScanned(data)}
      />
      <SafeAreaView style={{ flex: 1, justifyContent: 'space-between', padding: 20 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Pressable accessibilityLabel="Voltar" onPress={() => router.back()} style={scan.round}>
            <Ionicons name="close" size={26} color="#fff" />
          </Pressable>
          <Pressable accessibilityLabel={torch ? 'Desligar lanterna' : 'Ligar lanterna'} onPress={() => setTorch((t) => !t)} style={scan.round}>
            <Ionicons name={torch ? 'flashlight' : 'flashlight-outline'} size={24} color="#fff" />
          </Pressable>
        </View>
        <View style={scan.frame} />
        <View style={{ gap: 12 }}>
          <View style={scan.hint}>
            <Text style={{ color: '#fff', fontSize: 16, textAlign: 'center' }}>
              {message ?? 'Aponte a câmera para o QR Code colado no veículo.'}
            </Text>
          </View>
          <Button variant="outline" title="Escolher na lista" onPress={() => router.replace('/vehicles')} />
        </View>
      </SafeAreaView>
    </View>
  );
}

const scan = StyleSheet.create({
  round: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  frame: { alignSelf: 'center', width: 240, height: 240, borderRadius: 24, borderWidth: 4, borderColor: colors.primary },
  hint: { backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12, padding: 14 },
});
