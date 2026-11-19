/** Formatos devolvidos pela API do CHECK-ON (rotas /auth/app-login e /mobile/*). */

export type SessionUser = {
  id: string;
  name: string;
  tenantId: string;
  tenantName: string;
  tenantCode: string | null;
  role: string;
};

export type Session = {
  accessToken: string;
  refreshToken: string;
  user: SessionUser;
};

export type ItemType = 'PASS_FAIL' | 'TEXT' | 'NUMBER' | 'PHOTO';
export type PhotoRequirement = 'NONE' | 'ON_NON_COMPLIANCE' | 'ALWAYS';

export type TemplateItem = {
  id: string;
  text: string;
  type: ItemType | string;
  isRequired: boolean;
  isCritical: boolean;
  photoRequirement: PhotoRequirement | string;
  order: number;
};

export type TemplateCategory = {
  id: string;
  name: string;
  order: number;
  items: TemplateItem[];
};

export type Template = {
  id: string;
  name: string;
  description: string | null;
  version: number;
  updatedAt: string;
  categories: TemplateCategory[];
};

export type VehicleStatus = 'LIBERADO' | 'ATENCAO' | 'BLOQUEADO' | string;

export type Vehicle = {
  id: string;
  plate: string;
  prefix: string | null;
  brand: string | null;
  model: string | null;
  year: number | null;
  status: VehicleStatus;
  mileage: number | null;
  qrCode: string | null;
  fleet: { id: string; name: string } | null;
};

export type OpenNc = {
  id: string;
  vehicleId: string;
  itemId: string;
  status: string;
  severity: string;
  notes: string | null;
  occurrences: number;
  lastOccurrenceAt: string | null;
  createdAt: string;
  item: { text: string; isCritical: boolean } | null;
};

export type Bootstrap = {
  serverTime: string;
  templates: Template[];
  vehicles: Vehicle[];
  openNcs: OpenNc[];
  /** Quando o aparelho baixou estes dados (preenchido no app). */
  downloadedAt: string;
};

/** Resposta de um item, como o app guarda até enviar. */
export type Answer = {
  itemId: string;
  isCompliant?: boolean;
  textValue?: string;
  numberValue?: number;
  observations?: string;
  /** Foto ainda no aparelho (file://...). */
  localPhotoUri?: string;
  /** Endereço da foto depois de enviada (POST /checklists/photos). */
  photoUrl?: string;
};

export type SubmitPayload = {
  clientId: string;
  templateId: string;
  templateVersion: number;
  vehicleId: string;
  startedAt: string;
  completedAt: string;
  latitude?: number;
  longitude?: number;
  answers: Answer[];
};

/** Inspeção na fila de envio do aparelho. */
export type QueuedInspection = {
  clientId: string;
  payload: SubmitPayload;
  vehicleLabel: string;
  templateName: string;
  queuedAt: string;
  /** PENDING: aguardando envio. REJECTED: o servidor recusou e a pessoa precisa ver o motivo. */
  state: 'PENDING' | 'REJECTED';
  message?: string;
  attempts: number;
};

export type SyncItemResult =
  | { status: 'CREATED'; clientId: string; checklistId: string; ncsOpened: number; ncsRecurrent: number; vehicleStatus: string }
  | { status: 'DUPLICATE'; clientId: string; checklistId: string }
  | { status: 'REJECTED' | 'RETRY'; clientId: string; message: string };
