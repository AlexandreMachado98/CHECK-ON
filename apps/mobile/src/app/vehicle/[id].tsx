import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { Banner, Card, SectionTitle, StatusBadge, Tag, colors, styles } from '../../components/ui';
import { api } from '../../lib/api';
import { useApp } from '../../lib/app-state';
import { clearDraft, readDraft } from '../../lib/draft';
import { deletePhoto } from '../../lib/photos';
import { countItems, formatDateTime, SEVERITY_LABEL, vehicleLabel } from '../../lib/rules';
import type { OpenNc, Template } from '../../lib/types';

export default function VehicleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { bootstrap, online, user } = useApp();
  const vehicle = bootstrap?.vehicles.find((v) => v.id === id);
  const cachedNcs = useMemo(() => (bootstrap?.openNcs ?? []).filter((nc) => nc.vehicleId === id), [bootstrap, id]);
  const [freshNcs, setFreshNcs] = useState<OpenNc[] | null>(null);
  const ncs = freshNcs ?? cachedNcs;
  const templates = bootstrap?.templates ?? [];

  // Com internet, confere as NCs na hora (outro motorista pode ter apontado algo hoje).
  useEffect(() => {
    if (!online || !id) return;
    let alive = true;
    api<OpenNc[]>(`/mobile/vehicles/${id}/ncs`)
      .then((list) => alive && setFreshNcs(list))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [id, online]);

  async function start(template: Template) {
    if (!user || !vehicle) return;
    const draft = await readDraft(user.id);
    const go = () => router.push({ pathname: '/inspection', params: { vehicleId: vehicle.id, templateId: template.id } });
    if (draft && (draft.vehicleId !== vehicle.id || draft.templateId !== template.id)) {
      Alert.alert(
        'Inspeção em andamento',
        `Você começou uma inspeção do veículo ${draft.vehicleLabel} (${draft.templateName}) e não concluiu. O que deseja fazer?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Continuar a anterior',
            onPress: () => router.push({ pathname: '/inspection', params: { vehicleId: draft.vehicleId, templateId: draft.templateId } }),
          },
          {
            text: 'Descartar e começar esta',
            style: 'destructive',
            onPress: async () => {
              Object.values(draft.answers).forEach((answer) => deletePhoto(answer.localPhotoUri));
              await clearDraft(user.id);
              go();
            },
          },
        ],
      );
      return;
    }
    go();
  }

  if (!vehicle) {
    return (
      <View style={[styles.screen, styles.content]}>
        <Banner tone="warning" title="Veículo não encontrado">
          Este veículo não está mais ativo ou ainda não foi baixado para o celular. Atualize os dados na tela inicial.
        </Banner>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: vehicle.plate }} />
      <Card style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={[styles.title, { fontSize: 26 }]}>{vehicleLabel(vehicle)}</Text>
          <StatusBadge status={vehicle.status} />
        </View>
        <Text style={styles.muted}>
          {[vehicle.brand, vehicle.model, vehicle.year].filter(Boolean).join(' ') || 'Sem modelo cadastrado'}
          {vehicle.fleet ? ` · Frota ${vehicle.fleet.name}` : ''}
        </Text>
      </Card>

      {vehicle.status === 'BLOQUEADO' && (
        <Banner tone="danger" title="Veículo bloqueado">
          Este veículo tem problema crítico em aberto e não deve circular até ser liberado pelo gestor.
        </Banner>
      )}

      <SectionTitle>NCs em aberto ({ncs.length})</SectionTitle>
      {ncs.length === 0 ? (
        <Text style={styles.muted}>Nenhuma não conformidade em aberto neste veículo.</Text>
      ) : (
        ncs.map((nc) => (
          <Card key={nc.id} style={{ gap: 6, borderLeftWidth: 4, borderLeftColor: nc.severity === 'CRITICAL' ? colors.danger : colors.warning }}>
            <Text style={[styles.text, { fontWeight: '700' }]}>{nc.item?.text ?? 'Item do checklist'}</Text>
            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
              <Tag text={`Gravidade ${SEVERITY_LABEL[nc.severity] ?? nc.severity}`} tone={nc.severity === 'CRITICAL' ? 'danger' : 'warning'} />
              <Tag text={nc.status === 'IN_PROGRESS' ? 'Em tratamento' : 'Aberta'} tone="info" />
              {nc.occurrences > 1 && <Tag text={`${nc.occurrences}x apontada`} />}
            </View>
            {nc.notes ? <Text style={styles.muted}>{nc.notes}</Text> : null}
            <Text style={styles.muted}>Desde {formatDateTime(nc.createdAt)}</Text>
          </Card>
        ))
      )}

      <SectionTitle>Escolha o checklist</SectionTitle>
      {templates.length === 0 && <Text style={styles.muted}>A empresa ainda não tem checklists ativos.</Text>}
      {templates.map((template) => (
        <Pressable key={template.id} onPress={() => start(template)} accessibilityRole="button">
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Ionicons name="clipboard-outline" size={26} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.text, { fontWeight: '700' }]}>{template.name}</Text>
              <Text style={styles.muted}>
                {countItems(template)} itens{template.description ? ` · ${template.description}` : ''}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.muted} />
          </Card>
        </Pressable>
      ))}
    </ScrollView>
  );
}
