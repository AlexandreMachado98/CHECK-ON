import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { Banner, Button, colors, styles } from '../components/ui';
import { useApp } from '../lib/app-state';

export default function DoneScreen() {
  const { clientId } = useLocalSearchParams<{ clientId: string }>();
  const { queue, syncing, online, sync } = useApp();
  const item = queue.find((q) => q.clientId === clientId);
  const sent = !item;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { alignItems: 'stretch', paddingTop: 40 }]}>
      <View style={{ alignItems: 'center', gap: 10 }}>
        <Ionicons
          name={sent ? 'checkmark-circle' : item?.state === 'REJECTED' ? 'alert-circle' : 'cloud-upload-outline'}
          size={88}
          color={sent ? colors.primary : item?.state === 'REJECTED' ? colors.danger : colors.warning}
        />
        <Text style={[styles.title, { textAlign: 'center' }]}>
          {sent ? 'Inspeção enviada' : item?.state === 'REJECTED' ? 'Inspeção recusada' : syncing ? 'Enviando...' : 'Inspeção guardada'}
        </Text>
        <Text style={[styles.muted, { textAlign: 'center' }]}>
          {sent
            ? 'O gestor já pode ver a inspeção no portal.'
            : item?.state === 'REJECTED'
              ? 'O servidor não aceitou esta inspeção. Veja o motivo abaixo.'
              : online
                ? 'Está sendo enviada agora. Você pode continuar usando o aplicativo.'
                : 'Ela fica guardada no celular e é enviada sozinha quando a internet voltar.'}
        </Text>
      </View>
      {item?.state === 'REJECTED' && item.message ? <Banner tone="danger" title="Motivo">{item.message}</Banner> : null}
      {item?.state === 'PENDING' && online && !syncing && <Button variant="outline" title="Tentar enviar agora" onPress={() => sync()} />}
      <Button large title="Nova inspeção" onPress={() => router.replace('/vehicles')} />
      <Button variant="outline" title="Voltar ao início" onPress={() => router.dismissAll()} />
    </ScrollView>
  );
}
