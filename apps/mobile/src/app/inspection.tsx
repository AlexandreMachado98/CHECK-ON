import { Ionicons } from '@expo/vector-icons';
import * as Crypto from 'expo-crypto';
import * as Location from 'expo-location';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View, type ScrollViewInstance } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Banner, Button, Card, SectionTitle, Tag, colors, styles } from '../components/ui';
import { useApp } from '../lib/app-state';
import { clearDraft, readDraft, saveDraft, type Draft } from '../lib/draft';
import { CameraPermissionError, deletePhoto, recoverPendingPhoto, takePhoto } from '../lib/photos';
import {
  answersToSend, countItems, hasPhoto, isAnswered, parseNumber, pendingItems, vehicleLabel,
} from '../lib/rules';
import type { Answer, TemplateItem } from '../lib/types';

/** Localização é "melhor esforço": sem permissão ou sem sinal, a inspeção segue sem ela. */
async function currentLocation(): Promise<{ latitude: number; longitude: number } | null> {
  try {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) return null;
    const last = await Location.getLastKnownPositionAsync({ maxAge: 5 * 60 * 1000 });
    const position =
      last ??
      (await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 6000)),
      ]));
    return position ? { latitude: position.coords.latitude, longitude: position.coords.longitude } : null;
  } catch {
    return null;
  }
}

export default function InspectionScreen() {
  const { vehicleId, templateId } = useLocalSearchParams<{ vehicleId: string; templateId: string }>();
  const { bootstrap, user, addToQueue } = useApp();
  const vehicle = bootstrap?.vehicles.find((v) => v.id === vehicleId);
  const template = bootstrap?.templates.find((t) => t.id === templateId);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [highlight, setHighlight] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState<string | null>(null);
  const scrollRef = useRef<ScrollViewInstance>(null);
  // Posição de cada item na tela (categoria + item), para rolar até o que falta responder.
  const categoryY = useRef(new Map<string, number>());
  const itemY = useRef(new Map<string, { categoryId: string; y: number }>());
  const draftRef = useRef<Draft | null>(null);
  draftRef.current = draft;

  const ncItemIds = useMemo(
    () => new Set((bootstrap?.openNcs ?? []).filter((nc) => nc.vehicleId === vehicleId).map((nc) => nc.itemId)),
    [bootstrap, vehicleId],
  );

  // Retoma o rascunho desta inspeção ou começa uma nova.
  useEffect(() => {
    if (!user || !vehicle || !template) return;
    let alive = true;
    (async () => {
      const saved = await readDraft(user.id);
      let next: Draft =
        saved && saved.vehicleId === vehicle.id && saved.templateId === template.id
          ? saved
          : {
              clientId: Crypto.randomUUID(),
              vehicleId: vehicle.id,
              vehicleLabel: vehicleLabel(vehicle),
              templateId: template.id,
              templateName: template.name,
              templateVersion: template.version,
              startedAt: new Date().toISOString(),
              answers: {},
            };
      if (next.photoItemId) {
        // O Android fechou o app enquanto a câmera estava aberta: recupera a foto.
        const uri = await recoverPendingPhoto();
        const itemId = next.photoItemId;
        next = { ...next, photoItemId: undefined };
        if (uri) next.answers = { ...next.answers, [itemId]: { ...next.answers[itemId], itemId, localPhotoUri: uri, photoUrl: undefined } };
      }
      await saveDraft(user.id, next);
      if (alive) setDraft(next);
    })();
    return () => {
      alive = false;
    };
  }, [user, vehicle, template]);

  const update = useCallback(
    (itemId: string, patch: Partial<Answer>) => {
      const current = draftRef.current;
      if (!current || !user) return;
      const next: Draft = { ...current, answers: { ...current.answers, [itemId]: { ...current.answers[itemId], ...patch, itemId } } };
      draftRef.current = next;
      setDraft(next);
      saveDraft(user.id, next);
      setHighlight((h) => {
        if (!h.has(itemId)) return h;
        const copy = new Set(h);
        copy.delete(itemId);
        return copy;
      });
    },
    [user],
  );

  const photo = useCallback(
    async (itemId: string) => {
      const current = draftRef.current;
      if (!current || !user) return;
      setPhotoBusy(itemId);
      // Marca o item antes de abrir a câmera, para recuperar a foto se o Android fechar o app.
      await saveDraft(user.id, { ...current, photoItemId: itemId });
      try {
        const uri = await takePhoto();
        if (uri) {
          deletePhoto(draftRef.current?.answers[itemId]?.localPhotoUri);
          update(itemId, { localPhotoUri: uri, photoUrl: undefined });
        }
      } catch (error) {
        Alert.alert(
          error instanceof CameraPermissionError ? 'Câmera bloqueada' : 'Foto não salva',
          error instanceof Error ? error.message : 'Tente tirar a foto de novo.',
        );
      } finally {
        const latest = draftRef.current;
        if (latest) await saveDraft(user.id, { ...latest, photoItemId: undefined });
        setPhotoBusy(null);
      }
    },
    [update, user],
  );

  const removePhoto = useCallback(
    (itemId: string) => {
      deletePhoto(draftRef.current?.answers[itemId]?.localPhotoUri);
      update(itemId, { localPhotoUri: undefined, photoUrl: undefined });
    },
    [update],
  );

  if (!vehicle || !template) {
    return (
      <View style={[styles.screen, styles.content]}>
        <Banner tone="warning" title="Checklist indisponível">
          O veículo ou o checklist não está mais ativo. Atualize os dados na tela inicial.
        </Banner>
      </View>
    );
  }
  if (!draft || !user) {
    return (
      <View style={[styles.screen, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const total = countItems(template);
  const answered = template.categories.reduce(
    (sum, category) => sum + category.items.filter((item) => isAnswered(item, draft.answers[item.id])).length,
    0,
  );
  const nonCompliant = template.categories
    .flatMap((category) => category.items)
    .filter((item) => item.type === 'PASS_FAIL' && draft.answers[item.id]?.isCompliant === false);

  async function finish() {
    const current = draftRef.current;
    if (!current || !template || !vehicle || !user) return;
    const pendencies = pendingItems(template, current.answers);
    if (pendencies.length) {
      setHighlight(new Set(pendencies.map((p) => p.itemId)));
      const position = itemY.current.get(pendencies[0].itemId);
      if (position) {
        const y = (categoryY.current.get(position.categoryId) ?? 0) + position.y;
        scrollRef.current?.scrollTo({ y: Math.max(0, y - 12), animated: true });
      }
      const list = pendencies.slice(0, 5).map((p) => `• ${p.message}`).join('\n');
      Alert.alert('Falta pouco', `${list}${pendencies.length > 5 ? `\n...e mais ${pendencies.length - 5}.` : ''}`);
      return;
    }
    const critical = nonCompliant.filter((item) => item.isCritical).length;
    const summary = nonCompliant.length
      ? `${nonCompliant.length} item(ns) não conforme(s)${critical ? `, ${critical} crítico(s)` : ''}. Vai abrir não conformidade para o gestor.`
      : 'Todos os itens conformes.';
    Alert.alert('Concluir inspeção?', `${vehicleLabel(vehicle)} · ${template.name}\n\n${summary}`, [
      { text: 'Revisar', style: 'cancel' },
      { text: 'Concluir', onPress: () => save(current) },
    ]);
  }

  async function save(current: Draft) {
    if (!template || !vehicle || !user) return;
    setSaving(true);
    try {
      const location = await currentLocation();
      await addToQueue({
        clientId: current.clientId,
        vehicleLabel: current.vehicleLabel,
        templateName: current.templateName,
        queuedAt: new Date().toISOString(),
        state: 'PENDING',
        attempts: 0,
        payload: {
          clientId: current.clientId,
          templateId: current.templateId,
          templateVersion: current.templateVersion,
          vehicleId: current.vehicleId,
          startedAt: current.startedAt,
          completedAt: new Date().toISOString(),
          ...(location ?? {}),
          answers: answersToSend(template, current.answers),
        },
      });
      await clearDraft(user.id);
      router.dismissAll();
      router.push({ pathname: '/done', params: { clientId: current.clientId } });
    } catch {
      setSaving(false);
      Alert.alert('Não foi possível salvar', 'Tente de novo. As respostas continuam guardadas no celular.');
    }
  }

  function discardDraft() {
    Alert.alert('Descartar esta inspeção?', 'As respostas e fotos desta inspeção serão apagadas do celular.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Descartar',
        style: 'destructive',
        onPress: async () => {
          if (!user) return;
          Object.values(draftRef.current?.answers ?? {}).forEach((answer) => deletePhoto(answer.localPhotoUri));
          await clearDraft(user.id);
          router.back();
        },
      },
    ]);
  }

  return (
    <SafeAreaView edges={['bottom']} style={styles.screen}>
      <Stack.Screen
        options={{
          title: vehicle.plate,
          headerRight: () => (
            <Pressable onPress={discardDraft} accessibilityLabel="Descartar inspeção" hitSlop={10}>
              <Ionicons name="trash-outline" size={22} color={colors.danger} />
            </Pressable>
          ),
        }}
      />
      <View style={{ paddingHorizontal: 16, paddingVertical: 10, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 6 }}>
        <Text style={[styles.text, { fontWeight: '700' }]} numberOfLines={1}>{template.name}</Text>
        <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.border, overflow: 'hidden' }}>
          <View style={{ height: 8, width: `${total ? (answered / total) * 100 : 0}%`, backgroundColor: colors.primary }} />
        </View>
        <Text style={styles.muted}>
          {answered} de {total} respondidos{nonCompliant.length ? ` · ${nonCompliant.length} não conforme(s)` : ''} · salvo no celular
        </Text>
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView ref={scrollRef} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {template.categories.map((category) => (
            <View key={category.id} style={{ gap: 10 }} onLayout={(event) => categoryY.current.set(category.id, event.nativeEvent.layout.y)}>
              <SectionTitle>{category.name}</SectionTitle>
              {category.items.map((item) => (
                <View key={item.id} onLayout={(event) => itemY.current.set(item.id, { categoryId: category.id, y: event.nativeEvent.layout.y })}>
                  <ItemCard
                    item={item}
                    answer={draft.answers[item.id]}
                    hasOpenNc={ncItemIds.has(item.id)}
                    highlighted={highlight.has(item.id)}
                    photoBusy={photoBusy === item.id}
                    onChange={update}
                    onPhoto={photo}
                    onRemovePhoto={removePhoto}
                  />
                </View>
              ))}
            </View>
          ))}
          <Button large title="Concluir inspeção" loading={saving} onPress={finish} style={{ marginTop: 8 }} testID="finish" />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

type ItemCardProps = {
  item: TemplateItem;
  answer?: Answer;
  hasOpenNc: boolean;
  highlighted: boolean;
  photoBusy: boolean;
  onChange: (itemId: string, patch: Partial<Answer>) => void;
  onPhoto: (itemId: string) => void;
  onRemovePhoto: (itemId: string) => void;
};

const ItemCard = memo(function ItemCard({ item, answer, hasOpenNc, highlighted, photoBusy, onChange, onPhoto, onRemovePhoto }: ItemCardProps) {
  const [numberText, setNumberText] = useState(answer?.numberValue !== undefined ? String(answer.numberValue).replace('.', ',') : '');
  const [showNotes, setShowNotes] = useState(!!answer?.observations);
  const failed = answer?.isCompliant === false;
  // Foto só aparece quando faz sentido: item de foto, foto sempre exigida ou item apontado como não conforme.
  const needsPhoto = item.type === 'PHOTO' || item.photoRequirement === 'ALWAYS' || (item.photoRequirement === 'ON_NON_COMPLIANCE' && failed);
  const numberInvalid = numberText.trim() !== '' && parseNumber(numberText) === undefined;

  return (
    <Card style={[{ gap: 10 }, highlighted && { borderColor: colors.danger, borderWidth: 2 }, failed && { backgroundColor: '#FFFBFB' }]}>
      <View style={{ gap: 6 }}>
        <Text style={[styles.text, { fontSize: 16, fontWeight: '600' }]}>{item.text}</Text>
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          {item.isCritical && <Tag text="Crítico" tone="danger" />}
          {!item.isRequired && <Tag text="Opcional" />}
          {item.photoRequirement === 'ALWAYS' && item.type !== 'PHOTO' && <Tag text="Foto obrigatória" tone="info" />}
          {hasOpenNc && <Tag text="NC em aberto neste item" tone="warning" />}
        </View>
      </View>

      {item.type === 'PASS_FAIL' && (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Choice label="Conforme" icon="checkmark-circle" active={answer?.isCompliant === true} color={colors.primary} onPress={() => onChange(item.id, { isCompliant: true })} />
          <Choice label="Não conforme" icon="close-circle" active={failed} color={colors.danger} onPress={() => onChange(item.id, { isCompliant: false })} />
        </View>
      )}

      {item.type === 'TEXT' && (
        <TextInput
          style={[styles.input, { minHeight: 80, paddingTop: 12, textAlignVertical: 'top' }]}
          multiline
          maxLength={2000}
          value={answer?.textValue ?? ''}
          onChangeText={(text) => onChange(item.id, { textValue: text })}
          placeholder="Escreva aqui"
          placeholderTextColor={colors.muted}
        />
      )}

      {item.type === 'NUMBER' && (
        <View>
          <TextInput
            style={[styles.input, numberInvalid && { borderColor: colors.danger }]}
            keyboardType="decimal-pad"
            value={numberText}
            onChangeText={(text) => {
              setNumberText(text);
              onChange(item.id, { numberValue: parseNumber(text) });
            }}
            placeholder="0"
            placeholderTextColor={colors.muted}
          />
          {numberInvalid && <Text style={{ color: colors.danger, marginTop: 4 }}>Digite só números (ex.: 12,5).</Text>}
        </View>
      )}

      {needsPhoto && (
        <View style={{ gap: 8 }}>
          {hasPhoto(answer) && answer?.localPhotoUri ? (
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
              <Image source={{ uri: answer.localPhotoUri }} style={{ width: 96, height: 96, borderRadius: 10, backgroundColor: colors.border }} />
              <View style={{ flex: 1, gap: 8 }}>
                <Button variant="outline" title="Tirar outra" loading={photoBusy} onPress={() => onPhoto(item.id)} />
                <Button variant="ghost" title="Remover foto" onPress={() => onRemovePhoto(item.id)} />
              </View>
            </View>
          ) : (
            <Button
              variant="outline"
              title={failed ? 'Fotografar o problema' : 'Tirar foto'}
              loading={photoBusy}
              icon={<Ionicons name="camera-outline" size={20} color={colors.text} />}
              onPress={() => onPhoto(item.id)}
            />
          )}
        </View>
      )}

      {(failed || showNotes) ? (
        <TextInput
          style={[styles.input, { minHeight: 64, paddingTop: 10, fontSize: 15, textAlignVertical: 'top' }]}
          multiline
          maxLength={2000}
          value={answer?.observations ?? ''}
          onChangeText={(text) => onChange(item.id, { observations: text })}
          placeholder={failed ? 'Descreva o problema (opcional)' : 'Observação (opcional)'}
          placeholderTextColor={colors.muted}
        />
      ) : (
        <Pressable onPress={() => setShowNotes(true)} hitSlop={6}>
          <Text style={{ color: colors.info, fontWeight: '600' }}>+ Observação</Text>
        </Pressable>
      )}
    </Card>
  );
});

function Choice({ label, icon, active, color, onPress }: { label: string; icon: 'checkmark-circle' | 'close-circle'; active: boolean; color: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={{
        flex: 1,
        minHeight: 52,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: active ? color : colors.border,
        backgroundColor: active ? color : colors.card,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
      }}
    >
      <Ionicons name={icon} size={22} color={active ? '#fff' : color} />
      <Text style={{ fontSize: 15, fontWeight: '700', color: active ? '#fff' : colors.text }}>{label}</Text>
    </Pressable>
  );
}
