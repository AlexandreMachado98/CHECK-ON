import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Alert, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Banner, Button, Card, colors, styles } from '../components/ui';
import { useApp } from '../lib/app-state';
import { formatDateTime } from '../lib/rules';

export default function HomeScreen() {
  const app = useApp();
  const { user, bootstrap, queue, online } = app;
  const pending = queue.filter((item) => item.state === 'PENDING').length;
  const rejected = queue.filter((item) => item.state === 'REJECTED').length;
  const firstName = user?.name.split(' ')[0] ?? '';
  const noData = !bootstrap;

  function confirmLogout() {
    const warning = pending
      ? `\n\nVocê tem ${pending} inspeção(ões) ainda não enviada(s). Elas ficam guardadas neste celular e são enviadas quando você entrar de novo.`
      : '';
    Alert.alert('Sair do aplicativo?', `Para entrar de novo, use o código da empresa e a sua matrícula.${warning}`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: () => app.logout() },
    ]);
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={app.loadingBootstrap}
          onRefresh={() => {
            app.refreshBootstrap();
            app.sync();
          }}
          colors={[colors.primary]}
        />
      }
    >
      <View style={{ gap: 2 }}>
        <Text style={styles.title}>Olá, {firstName}</Text>
        <Text style={styles.muted}>
          {user?.tenantName}
          {user?.tenantCode ? ` · ${user.tenantCode}` : ''}
        </Text>
      </View>

      {!online && (
        <Banner tone="info" title="Sem internet">
          Você pode fazer inspeções normalmente. Elas ficam guardadas no celular e são enviadas quando a conexão voltar.
        </Banner>
      )}

      {noData && (
        <Banner tone={app.bootstrapError ? 'danger' : 'info'} title={app.loadingBootstrap ? 'Baixando os dados...' : 'Dados ainda não baixados'}>
          {app.bootstrapError ?? 'Na primeira vez, o aplicativo precisa de internet para baixar os veículos e os checklists da empresa.'}
        </Banner>
      )}

      <Button
        large
        title="Nova inspeção"
        icon={<Ionicons name="clipboard-outline" size={22} color="#fff" />}
        disabled={noData}
        onPress={() => router.push('/vehicles')}
        testID="new-inspection"
      />
      <Button
        large
        variant="outline"
        title="Ler QR Code do veículo"
        icon={<Ionicons name="qr-code-outline" size={22} color={colors.text} />}
        disabled={noData}
        onPress={() => router.push('/scan')}
      />

      <Pressable onPress={() => router.push('/queue')} accessibilityRole="button">
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Ionicons
            name={rejected ? 'alert-circle' : pending ? 'cloud-upload-outline' : 'cloud-done-outline'}
            size={28}
            color={rejected ? colors.danger : pending ? colors.warning : colors.primary}
          />
          <View style={{ flex: 1 }}>
            <Text style={[styles.text, { fontWeight: '700' }]}>
              {rejected
                ? `${rejected} inspeção(ões) recusada(s)`
                : pending
                  ? `${pending} inspeção(ões) aguardando envio`
                  : 'Tudo enviado'}
            </Text>
            <Text style={styles.muted}>
              {app.syncing
                ? 'Enviando...'
                : rejected
                  ? 'Toque para ver o motivo.'
                  : pending
                    ? online
                      ? 'Toque para enviar agora.'
                      : 'Serão enviadas quando houver internet.'
                    : 'Nenhuma inspeção pendente neste celular.'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.muted} />
        </Card>
      </Pressable>

      {bootstrap && (
        <Text style={[styles.muted, { textAlign: 'center' }]}>
          {bootstrap.vehicles.length} veículo(s) e {bootstrap.templates.length} checklist(s) no celular.{'\n'}
          Atualizado em {formatDateTime(bootstrap.downloadedAt)}. Puxe para baixo para atualizar.
        </Text>
      )}

      <Button variant="ghost" title="Sair" onPress={confirmLogout} icon={<Ionicons name="log-out-outline" size={20} color={colors.text} />} />
    </ScrollView>
  );
}
