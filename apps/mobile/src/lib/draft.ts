import { keys, readJson, removeKey, writeJson } from './storage';
import type { Answer } from './types';

/** Inspeção em andamento: salva a cada resposta, para não perder nada se o app fechar. */
export type Draft = {
  clientId: string;
  vehicleId: string;
  vehicleLabel: string;
  templateId: string;
  templateName: string;
  templateVersion: number;
  startedAt: string;
  answers: Record<string, Answer>;
  /** Item cuja foto estava sendo tirada (para recuperar se o Android fechar o app durante a câmera). */
  photoItemId?: string;
};

export const readDraft = (userId: string) => readJson<Draft>(keys.draft(userId));
export const saveDraft = (userId: string, draft: Draft) => writeJson(keys.draft(userId), draft);
export const clearDraft = (userId: string) => removeKey(keys.draft(userId));
