'use client';

import { useSyncExternalStore } from 'react';
import { getStoredUser } from './session';
import type { AuthUser } from './types';

/** Evento disparado quando a sessão deste navegador muda na mesma aba (o "storage" só avisa outras abas). */
export const STORED_USER_EVENT = 'checkon:user';

let cachedRaw: string | null | undefined;
let cachedUser: AuthUser | null = null;

/** Mesmo objeto enquanto o texto guardado não muda (o React compara a referência). */
function snapshot(): AuthUser | null {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem('user');
  } catch {
    raw = null;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedUser = raw ? getStoredUser() : null;
  }
  return cachedUser;
}

function subscribe(onChange: () => void) {
  window.addEventListener('storage', onChange);
  window.addEventListener(STORED_USER_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(STORED_USER_EVENT, onChange);
  };
}

/** Avisa as telas abertas que o usuário guardado mudou (ex.: troca de e-mail em Minha conta). */
export function notifyStoredUserChange() {
  window.dispatchEvent(new Event(STORED_USER_EVENT));
}

/**
 * Usuário logado guardado no navegador. No servidor (e na primeira pintura) é null; depois vem o
 * guardado, sem estado duplicado nem efeito que regrava a tela. Para decidir redirecionamento, leia
 * getStoredUser() dentro do efeito: aqui o primeiro valor é sempre null.
 */
export function useStoredUser(): AuthUser | null {
  return useSyncExternalStore(subscribe, snapshot, () => null);
}

const noSubscribe = () => () => {};

/** Endereço público do portal (NEXT_PUBLIC_APP_URL ou o do navegador); vazio no servidor. */
export function useAppOrigin(): string {
  return useSyncExternalStore(noSubscribe, () => process.env.NEXT_PUBLIC_APP_URL || window.location.origin, () => '');
}

/** false no servidor e na primeira pintura (hidratação); true depois, no navegador. */
export function useHydrated(): boolean {
  return useSyncExternalStore(noSubscribe, () => true, () => false);
}
