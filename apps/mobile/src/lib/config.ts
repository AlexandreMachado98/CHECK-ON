import Constants from 'expo-constants';

/** Endereço da API. Vem de app.json (expo.extra.apiUrl); dá para trocar sem mexer no código. */
export const API_URL: string = String(
  (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl ?? 'https://check-on-mu.vercel.app/api',
).replace(/\/+$/, '');

export const APP_VERSION: string = Constants.expoConfig?.version ?? '1.0.0';
