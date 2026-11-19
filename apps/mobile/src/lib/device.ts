import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { APP_VERSION } from './config';

/** Texto curto do aparelho para o portal mostrar em "Enviada do aparelho". Ex.: "Android 14 - Samsung SM-A245M - app 1.0.0".
 * Só ASCII: o Android (OkHttp) recusa cabeçalho HTTP com acento ou "·". */
export function deviceInfo(): string {
  const os = `${Platform.OS === 'android' ? 'Android' : Platform.OS === 'ios' ? 'iOS' : Platform.OS} ${Device.osVersion ?? ''}`.trim();
  const model = [Device.manufacturer, Device.modelName].filter(Boolean).join(' ');
  const text = [os, model, `app ${APP_VERSION}`].filter(Boolean).join(' - ');
  return text.normalize('NFD').replace(/[^\x20-\x7e]/g, '').slice(0, 200);
}
