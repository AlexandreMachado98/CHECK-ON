import { Alert, ScrollView, Text, View } from 'react-native';
import { Banner, Button, Card, Tag, colors, styles } from '../components/ui';
import { useApp } from '../lib/app-state';
import { formatDateTime } from '../lib/rules';

export default function QueueScreen() {
  const { queue, syncing, online, sync, discardFromQueue, lastSync } = useApp();
  const pending = queue.filter((item) => item.state === 'PENDING');

  function confirmDiscard(clientId: string, label: string) {
    Alert.alert('Apagar esta inspeção?', `${label}\n\nEla foi recusada pelo servidor e será apagada deste celular. Se precisar, faça a inspeção de novo.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Apagar', style: 'destructive', onPress: () => discardFromQueue(clientId) },
    ]);
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {!online && pending.length > 0 && (
        <Banner tone="info" title="Sem internet">As inspeções serão enviadas sozinhas quando a conexão voltar.</Banner>
      )}
      {lastSync?.error && <Banner tone="danger" title="Erro no último envio">{lastSync.error}</Banner>}
      {pending.length > 0 && (
        <Button title={syncing ? 'Enviando...' : `Enviar agora (${pending.length})`} loading={syncing} disabled={!online} onPress={() => sync()} />
      )}
      {queue.length === 0 && (
        <Text style={[styles.muted, { textAlign: 'center', marginTop: 24 }]}>Tudo enviado. Nenhuma inspeção guardada neste celular.</Text>
      )}
      {queue.map((item) => {
        const photos = item.payload.answers.filter((a) => a.localPhotoUri).length;
        const label = `${item.vehicleLabel} · ${item.templateName}`;
        return (
          <Card key={item.clientId} style={{ gap: 6, borderLeftWidth: 4, borderLeftColor: item.state === 'REJECTED' ? colors.danger : colors.warning }}>
            <Text style={[styles.text, { fontWeight: '700' }]}>{label}</Text>
            <Text style={styles.muted}>
              Feita em {formatDateTime(item.payload.completedAt)}
              {photos ? ` · ${photos} foto(s)` : ''}
            </Text>
            <View style={{ flexDirection: 'row' }}>
              <Tag text={item.state === 'REJECTED' ? 'Recusada' : 'Aguardando envio'} tone={item.state === 'REJECTED' ? 'danger' : 'warning'} />
            </View>
            {item.state === 'REJECTED' && (
              <>
                <Text style={[styles.text, { color: colors.danger }]}>{item.message}</Text>
                <Button variant="outline" title="Apagar do celular" onPress={() => confirmDiscard(item.clientId, label)} />
              </>
            )}
          </Card>
        );
      })}
    </ScrollView>
  );
}
