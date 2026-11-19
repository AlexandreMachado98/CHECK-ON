import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { Card, StatusBadge, colors, styles } from '../components/ui';
import { useApp } from '../lib/app-state';
import { matchesVehicle, vehicleLabel } from '../lib/rules';

export default function VehiclesScreen() {
  const { bootstrap } = useApp();
  const [query, setQuery] = useState('');
  const vehicles = useMemo(
    () => (bootstrap?.vehicles ?? []).filter((vehicle) => matchesVehicle(vehicle, query)),
    [bootstrap, query],
  );
  const ncCount = useMemo(() => {
    const counts = new Map<string, number>();
    for (const nc of bootstrap?.openNcs ?? []) counts.set(nc.vehicleId, (counts.get(nc.vehicleId) ?? 0) + 1);
    return counts;
  }, [bootstrap]);

  return (
    <View style={styles.screen}>
      <View style={{ padding: 16, paddingBottom: 8, gap: 8 }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar placa, prefixo ou modelo"
            placeholderTextColor={colors.muted}
            autoCapitalize="characters"
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
          <Pressable
            accessibilityLabel="Ler QR Code"
            onPress={() => router.push('/scan')}
            style={[styles.input, { width: 52, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 0 }]}
          >
            <Ionicons name="qr-code-outline" size={24} color={colors.text} />
          </Pressable>
        </View>
      </View>
      <FlatList
        data={vehicles}
        keyExtractor={(vehicle) => vehicle.id}
        contentContainerStyle={{ padding: 16, paddingTop: 0, gap: 10, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <Text style={[styles.muted, { textAlign: 'center', marginTop: 24 }]}>
            {query ? 'Nenhum veículo encontrado.' : 'A empresa ainda não tem veículos ativos.'}
          </Text>
        }
        renderItem={({ item: vehicle }) => {
          const ncs = ncCount.get(vehicle.id) ?? 0;
          return (
            <Pressable onPress={() => router.push({ pathname: '/vehicle/[id]', params: { id: vehicle.id } })} accessibilityRole="button">
              <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={[styles.text, { fontSize: 18, fontWeight: '800' }]}>{vehicleLabel(vehicle)}</Text>
                  <Text style={styles.muted} numberOfLines={1}>
                    {[vehicle.brand, vehicle.model, vehicle.year].filter(Boolean).join(' ') || 'Sem modelo'}
                    {vehicle.fleet ? ` · ${vehicle.fleet.name}` : ''}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                    <StatusBadge status={vehicle.status} />
                    {ncs > 0 && <Text style={{ color: colors.warning, fontSize: 12, fontWeight: '700' }}>{ncs} NC(s) em aberto</Text>}
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.muted} />
              </Card>
            </Pressable>
          );
        }}
      />
    </View>
  );
}
