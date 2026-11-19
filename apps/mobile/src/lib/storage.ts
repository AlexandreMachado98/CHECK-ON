import AsyncStorage from '@react-native-async-storage/async-storage';

/** Guarda dados em JSON no aparelho (continuam lá sem internet e depois de fechar o app). */
export async function readJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function writeJson(key: string, value: unknown): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export async function removeKey(key: string): Promise<void> {
  await AsyncStorage.removeItem(key);
}

/** Cada pessoa tem os próprios dados no aparelho (o celular pode ser compartilhado). */
export const keys = {
  bootstrap: (userId: string) => `checkon:bootstrap:${userId}`,
  outbox: (userId: string) => `checkon:outbox:${userId}`,
  draft: (userId: string) => `checkon:draft:${userId}`,
  lastCompanyCode: 'checkon:last-company-code',
};
