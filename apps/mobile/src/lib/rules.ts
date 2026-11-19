// Regras puras (sem React Native): testadas com `npm test`.
// Espelham as regras da API (apps/api/src/checklist/checklist-rules.ts) para avisar o motorista
// antes de salvar, sem depender de internet. A API continua sendo quem decide.

import type { Answer, TemplateItem, Template, Vehicle } from './types';

/** Diz se a resposta precisa vir com foto, conforme a configuração do item. */
export function photoIsRequired(item: TemplateItem, isCompliant: boolean): boolean {
  if (item.type === 'PHOTO') return false; // a própria foto é a resposta
  if (item.photoRequirement === 'ALWAYS') return true;
  return item.photoRequirement === 'ON_NON_COMPLIANCE' && !isCompliant;
}

export function hasPhoto(answer?: Answer): boolean {
  return !!(answer?.photoUrl || answer?.localPhotoUri);
}

export function isAnswered(item: TemplateItem, answer?: Answer): boolean {
  if (!answer) return false;
  switch (item.type) {
    case 'TEXT':
      return !!answer.textValue?.trim();
    case 'NUMBER':
      return typeof answer.numberValue === 'number' && Number.isFinite(answer.numberValue);
    case 'PHOTO':
      return hasPhoto(answer);
    default:
      return typeof answer.isCompliant === 'boolean';
  }
}

export function isCompliantAnswer(item: TemplateItem, answer?: Answer): boolean {
  return item.type === 'PASS_FAIL' ? answer?.isCompliant === true : answer?.isCompliant !== false;
}

export type Pendency = { itemId: string; message: string };

/** O que ainda falta para concluir a inspeção (mesmas regras da API). */
export function pendingItems(template: Template, answers: Record<string, Answer>): Pendency[] {
  const result: Pendency[] = [];
  for (const category of template.categories) {
    for (const item of category.items) {
      const answer = answers[item.id];
      const answered = isAnswered(item, answer);
      if (!answered) {
        if (item.isRequired) result.push({ itemId: item.id, message: `Responda: ${item.text}` });
        if (!answer || answer.isCompliant !== false) continue;
      }
      if (photoIsRequired(item, isCompliantAnswer(item, answer)) && !hasPhoto(answer)) {
        result.push({
          itemId: item.id,
          message:
            item.photoRequirement === 'ALWAYS'
              ? `Tire a foto: ${item.text}`
              : `Tire a foto do problema: ${item.text}`,
        });
      }
    }
  }
  return result;
}

/** Respostas que vão para a API: só itens respondidos, sem campos vazios. */
export function answersToSend(template: Template, answers: Record<string, Answer>): Answer[] {
  const list: Answer[] = [];
  for (const category of template.categories) {
    for (const item of category.items) {
      const answer = answers[item.id];
      if (!answer) continue;
      if (!isAnswered(item, answer) && answer.isCompliant !== false) continue;
      const clean: Answer = { itemId: item.id };
      if (typeof answer.isCompliant === 'boolean') clean.isCompliant = answer.isCompliant;
      if (item.type === 'TEXT' && answer.textValue?.trim()) clean.textValue = answer.textValue.trim();
      if (item.type === 'NUMBER' && typeof answer.numberValue === 'number') clean.numberValue = answer.numberValue;
      if (answer.observations?.trim()) clean.observations = answer.observations.trim();
      if (answer.localPhotoUri) clean.localPhotoUri = answer.localPhotoUri;
      if (answer.photoUrl) clean.photoUrl = answer.photoUrl;
      list.push(clean);
    }
  }
  return list;
}

export function countItems(template: Template): number {
  return template.categories.reduce((total, category) => total + category.items.length, 0);
}

/** "12,5" ou "12.5" → 12.5. Texto inválido → undefined. */
export function parseNumber(text: string): number | undefined {
  const normalized = text.trim().replace(/\s/g, '').replace(',', '.');
  if (!normalized || !/^-?\d+(\.\d+)?$/.test(normalized)) return undefined;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : undefined;
}

/** Placa sem traço, espaço ou diferença de maiúsculas: "abc-1d23" → "ABC1D23". */
export function normalizePlate(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Prefixo usado no QR Code impresso pelo portal: "CHECKON:VEICULO:<id do veículo>". */
export const VEHICLE_QR_PREFIX = 'CHECKON:VEICULO:';

/**
 * Acha o veículo pelo conteúdo do QR Code, sem internet: aceita o QR do portal,
 * o código de QR cadastrado no veículo ou a placa/prefixo escritos no QR.
 */
export function findVehicleByQr(vehicles: Vehicle[], raw: string): Vehicle | undefined {
  const data = raw.trim();
  if (!data) return undefined;
  if (data.toUpperCase().startsWith(VEHICLE_QR_PREFIX)) {
    const id = data.slice(VEHICLE_QR_PREFIX.length).trim();
    return vehicles.find((v) => v.id === id);
  }
  const byQr = vehicles.find((v) => v.qrCode && v.qrCode === data);
  if (byQr) return byQr;
  const plate = normalizePlate(data);
  if (!plate) return undefined;
  return (
    vehicles.find((v) => normalizePlate(v.plate) === plate) ??
    vehicles.find((v) => v.prefix && normalizePlate(v.prefix) === plate)
  );
}

export function vehicleLabel(vehicle: Pick<Vehicle, 'plate' | 'prefix'>): string {
  return vehicle.prefix ? `${vehicle.plate} · ${vehicle.prefix}` : vehicle.plate;
}

/** Filtro da lista de veículos: placa, prefixo, marca, modelo ou frota. */
export function matchesVehicle(vehicle: Vehicle, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const plate = normalizePlate(q);
  if (plate && normalizePlate(vehicle.plate).includes(plate)) return true;
  return [vehicle.prefix, vehicle.brand, vehicle.model, vehicle.fleet?.name]
    .filter(Boolean)
    .some((field) => String(field).toLowerCase().includes(q));
}

export const STATUS_LABEL: Record<string, string> = {
  LIBERADO: 'Liberado',
  ATENCAO: 'Atenção',
  BLOQUEADO: 'Bloqueado',
};

export const SEVERITY_LABEL: Record<string, string> = {
  LOW: 'Baixa',
  MEDIUM: 'Média',
  HIGH: 'Alta',
  CRITICAL: 'Crítica',
};

/** Mensagem de erro da API (NestJS devolve string ou lista em "message"). */
export function messageFromBody(body: unknown, fallback: string): string {
  if (body && typeof body === 'object' && 'message' in body) {
    const message = (body as { message: unknown }).message;
    if (Array.isArray(message)) {
      const parts = message.filter((m) => typeof m === 'string' && m.trim());
      if (parts.length) return parts.join('\n');
    }
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
}

/** Código da empresa como a API espera: sem espaços e em maiúsculas. */
export function normalizeCompanyCode(value: string): string {
  return value.replace(/\s/g, '').toUpperCase();
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)} às ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
