'use client';

import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import api from '@/lib/api';
import type { Employee, EmployeeTraining } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Activity, AlertTriangle, BriefcaseBusiness, Building2, CalendarDays, Camera, Check, CheckCircle2,
  Clock3, Copy, Edit2, ExternalLink, GraduationCap, Hash, Plus, QrCode, Search,
  ShieldCheck, ShieldOff, Trash2, User, Users,
} from 'lucide-react';

const EMPLOYEE_ROLES = [
  { value: 'MOTORISTA', label: 'Motorista' },
  { value: 'TECNICO', label: 'Técnico de Manutenção' },
  { value: 'OPERADOR', label: 'Operador de Frota' },
  { value: 'SUPERVISOR', label: 'Supervisor Operacional' },
];

const ROLE_COLOR: Record<string, string> = {
  MOTORISTA: 'bg-blue-50 text-blue-700 border-blue-200',
  TECNICO: 'bg-amber-50 text-amber-700 border-amber-200',
  OPERADOR: 'bg-purple-50 text-purple-700 border-purple-200',
  SUPERVISOR: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const today = () => new Date().toISOString().slice(0, 10);
const dateInput = (value?: string | null) => value ? value.slice(0, 10) : '';

function displayDate(value?: string | null) {
  if (!value) return 'Não informado';
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return 'Não informado';
  return new Intl.DateTimeFormat('pt-BR').format(new Date(year, month - 1, day));
}

interface TrainingFormData {
  name: string;
  completedAt: string;
  expiresAt: string;
}

interface EmployeeFormData {
  name: string;
  matricula: string;
  jobTitle: string;
  admissionDate: string;
  departmentName: string;
  supervisorId: string;
  companyIntegrationDate: string;
  companyIntegrationExpiresAt: string;
  clientIntegrationDate: string;
  clientIntegrationExpiresAt: string;
  trainings: TrainingFormData[];
  photoFile: File | null;
  photoUrl: string;
}

const EMPTY_FORM: EmployeeFormData = {
  name: '',
  matricula: '',
  jobTitle: 'MOTORISTA',
  admissionDate: today(),
  departmentName: '',
  supervisorId: '',
  companyIntegrationDate: '',
  companyIntegrationExpiresAt: '',
  clientIntegrationDate: '',
  clientIntegrationExpiresAt: '',
  trainings: [],
  photoFile: null,
  photoUrl: '',
};

function EmployeeForm({
  initial = EMPTY_FORM,
  supervisors,
  currentEmployeeId,
  onSubmit,
  onCancel,
  submitting,
  mode,
}: {
  initial?: EmployeeFormData;
  supervisors: Employee[];
  currentEmployeeId?: string;
  onSubmit: (data: EmployeeFormData) => Promise<void>;
  onCancel: () => void;
  submitting: boolean;
  mode: 'create' | 'edit';
}) {
  const [form, setForm] = useState<EmployeeFormData>(initial);
  const [photoPreview, setPhotoPreview] = useState(initial.photoUrl);

  useEffect(() => {
    if (!form.photoFile) {
      setPhotoPreview(form.photoUrl);
      return;
    }
    const objectUrl = URL.createObjectURL(form.photoFile);
    setPhotoPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [form.photoFile, form.photoUrl]);

  function setText(field: keyof EmployeeFormData) {
    return (event: ChangeEvent<HTMLInputElement>) =>
      setForm((current) => ({ ...current, [field]: event.target.value }));
  }

  function setTraining(index: number, field: keyof TrainingFormData, value: string) {
    setForm((current) => ({
      ...current,
      trainings: current.trainings.map((training, itemIndex) =>
        itemIndex === index ? { ...training, [field]: value } : training,
      ),
    }));
  }

  return (
    <form onSubmit={async (event) => { event.preventDefault(); await onSubmit(form); }} className="space-y-6 pt-2">
      <section className="grid gap-5 sm:grid-cols-[128px_minmax(0,1fr)]">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 text-slate-400">
            {photoPreview ? (
              // The photo is served by the API's local or configured object storage.
              <img src={photoPreview} alt="Prévia da foto do colaborador" className="h-full w-full object-cover" />
            ) : (
              <User className="h-10 w-10" aria-hidden="true" />
            )}
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
            <Camera className="h-4 w-4 text-emerald-700" aria-hidden="true" />
            {form.photoFile || form.photoUrl ? 'Trocar foto' : 'Adicionar foto'}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(event) => setForm((current) => ({
                ...current,
                photoFile: event.target.files?.[0] ?? null,
              }))}
            />
          </label>
          <span className="text-center text-[11px] leading-4 text-slate-500">JPEG, PNG ou WebP · até 5 MB</span>
        </div>

        <div className="grid content-start gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="employee-name">Nome completo *</Label>
            <Input id="employee-name" value={form.name} onChange={setText('name')} required maxLength={120} placeholder="Ex.: Carlos Eduardo de Souza" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="employee-matricula" className="flex items-center gap-1.5">
              <Hash className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" /> Matrícula *
            </Label>
            <Input id="employee-matricula" value={form.matricula} onChange={setText('matricula')} required maxLength={40} placeholder="MAT-2026-089" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="employee-role">Função / cargo *</Label>
            <Select value={form.jobTitle} onValueChange={(value) => setForm((current) => ({ ...current, jobTitle: value || '' }))}>
              <SelectTrigger id="employee-role"><SelectValue placeholder="Selecione a função" /></SelectTrigger>
              <SelectContent>
                {EMPLOYEE_ROLES.map((role) => <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="employee-admission">Data de admissão *</Label>
            <Input id="employee-admission" type="date" value={form.admissionDate} onChange={setText('admissionDate')} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="employee-department">Setor</Label>
            <Input id="employee-department" value={form.departmentName} onChange={setText('departmentName')} maxLength={100} placeholder="Ex.: Operações" />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="employee-supervisor">Supervisor responsável</Label>
            <Select
              value={form.supervisorId || 'NONE'}
              onValueChange={(value) => setForm((current) => ({ ...current, supervisorId: value === 'NONE' ? '' : value || '' }))}
            >
              <SelectTrigger id="employee-supervisor"><SelectValue placeholder="Selecione um supervisor" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="NONE">Sem supervisor vinculado</SelectItem>
                {supervisors
                  .filter((employee) => employee.isActive && employee.id !== currentEmployeeId)
                  .map((employee) => <SelectItem key={employee.id} value={employee.id}>{employee.name} · {employee.jobTitle || 'Colaborador'}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
            <Building2 className="h-4 w-4" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Integrações obrigatórias</h3>
            <p className="text-xs leading-5 text-slate-500">Registre a realização e a validade para acompanhar vencimentos.</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-600">Integração da empresa</h4>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="company-integration-date" className="text-xs">Realizada em</Label>
                <Input id="company-integration-date" type="date" value={form.companyIntegrationDate} onChange={setText('companyIntegrationDate')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="company-integration-expiry" className="text-xs">Válida até</Label>
                <Input id="company-integration-expiry" type="date" value={form.companyIntegrationExpiresAt} onChange={setText('companyIntegrationExpiresAt')} />
              </div>
            </div>
          </div>
          <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-600">Integração do cliente</h4>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="client-integration-date" className="text-xs">Realizada em</Label>
                <Input id="client-integration-date" type="date" value={form.clientIntegrationDate} onChange={setText('clientIntegrationDate')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="client-integration-expiry" className="text-xs">Válida até</Label>
                <Input id="client-integration-expiry" type="date" value={form.clientIntegrationExpiresAt} onChange={setText('clientIntegrationExpiresAt')} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-emerald-700" aria-hidden="true" />
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Treinamentos</h3>
              <p className="text-xs text-slate-500">Inclua certificados e validade quando houver.</p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setForm((current) => ({
              ...current,
              trainings: [...current.trainings, { name: '', completedAt: today(), expiresAt: '' }],
            }))}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" /> Adicionar treinamento
          </Button>
        </div>
        {form.trainings.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 px-4 py-5 text-center text-xs text-slate-500">
            Nenhum treinamento cadastrado.
          </div>
        ) : (
          <div className="space-y-3">
            {form.trainings.map((training, index) => (
              <div key={index} className="grid gap-3 rounded-xl border border-slate-200 p-3 sm:grid-cols-[minmax(0,1.5fr)_1fr_1fr_auto] sm:items-end">
                <div className="space-y-1.5">
                  <Label htmlFor={`training-name-${index}`} className="text-xs">Treinamento *</Label>
                  <Input id={`training-name-${index}`} value={training.name} maxLength={120} onChange={(event) => setTraining(index, 'name', event.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`training-date-${index}`} className="text-xs">Realizado em *</Label>
                  <Input id={`training-date-${index}`} type="date" value={training.completedAt} onChange={(event) => setTraining(index, 'completedAt', event.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`training-expiry-${index}`} className="text-xs">Válido até</Label>
                  <Input id={`training-expiry-${index}`} type="date" value={training.expiresAt} onChange={(event) => setTraining(index, 'expiresAt', event.target.value)} />
                </div>
                <Button type="button" variant="ghost" size="icon" aria-label={`Remover treinamento ${training.name || index + 1}`} onClick={() => setForm((current) => ({ ...current, trainings: current.trainings.filter((_, itemIndex) => itemIndex !== index) }))}>
                  <Trash2 className="h-4 w-4 text-rose-600" aria-hidden="true" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      <DialogFooter className="sticky bottom-0 -mx-4 -mb-4 border-t border-slate-100 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={submitting || !form.name.trim() || !form.matricula.trim() || !form.jobTitle || !form.admissionDate}>
          {submitting ? 'Salvando cadastro…' : mode === 'create' ? 'Cadastrar e gerar crachá' : 'Salvar alterações'}
        </Button>
      </DialogFooter>
    </form>
  );
}

function integrationStatus(expiry?: string | null) {
  if (!expiry) return { label: 'Validade não informada', className: 'bg-slate-100 text-slate-600' };
  const expiryDate = expiry.slice(0, 10);
  const now = today();
  if (expiryDate < now) return { label: 'Vencida', className: 'bg-rose-100 text-rose-700' };
  const daysLeft = Math.ceil((new Date(`${expiryDate}T00:00:00`).getTime() - new Date(`${now}T00:00:00`).getTime()) / 86400000);
  if (daysLeft <= 30) return { label: 'Vence em breve', className: 'bg-amber-100 text-amber-700' };
  return { label: 'Em dia', className: 'bg-emerald-100 text-emerald-700' };
}

function IntegrationLine({ title, doneAt, expiresAt }: { title: string; doneAt?: string | null; expiresAt?: string | null }) {
  const status = integrationStatus(expiresAt);
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-slate-100 py-2.5 first:border-0 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className="text-xs font-semibold text-slate-700">{title}</p>
        <p className="mt-0.5 text-[11px] text-slate-500">Realizada: {displayDate(doneAt)} · Válida até: {displayDate(expiresAt)}</p>
      </div>
      <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${status.className}`}>{status.label}</span>
    </div>
  );
}

function BadgeDialog({
  employee,
  onClose,
  onEmployeeUpdate,
}: {
  employee: Employee;
  onClose: () => void;
  onEmployeeUpdate: (employee: Employee) => void;
}) {
  const [origin, setOrigin] = useState('');
  const [token, setToken] = useState(employee.badgeToken || '');
  const [working, setWorking] = useState(false);
  const [copied, setCopied] = useState(false);
  const publicUrl = useMemo(
    () => token && origin ? `${origin.replace(/\/$/, '')}/badge/${token}` : '',
    [origin, token],
  );

  useEffect(() => {
    const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
    setOrigin(configuredOrigin);
  }, []);

  async function rotateToken() {
    if (token && !window.confirm('O QR atual deixará de funcionar. Gerar um novo crachá?')) return;
    try {
      setWorking(true);
      const response = await api.post<{ id: string; badgeToken: string }>(`/employees/${employee.id}/badge/rotate-token`);
      setToken(response.data.badgeToken);
      onEmployeeUpdate({ ...employee, badgeToken: response.data.badgeToken });
    } catch {
      alert('Não foi possível gerar o QR do crachá.');
    } finally {
      setWorking(false);
    }
  }

  async function copyLink() {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      alert('O navegador não permitiu copiar o link. Você pode copiá-lo pela barra de endereço após abrir o crachá.');
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-none max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Crachá virtual</DialogTitle>
          <DialogDescription>Identificação CHECK-ON com consulta pública pelo QR Code.</DialogDescription>
        </DialogHeader>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 px-5 py-5 text-white sm:px-7">
            <div className="absolute -right-10 -top-16 h-44 w-44 rounded-full border border-white/10" />
            <div className="absolute -right-4 -top-10 h-32 w-32 rounded-full border border-white/10" />
            <div className="relative flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-lg shadow-emerald-950/30">
                  <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-extrabold tracking-wide">CHECK-ON</p>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-200">Identificação operacional</p>
                </div>
              </div>
              <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${employee.isActive ? 'border-emerald-300/30 bg-emerald-300/10 text-emerald-200' : 'border-rose-300/30 bg-rose-300/10 text-rose-200'}`}>
                {employee.isActive ? 'Ativo' : 'Inativo'}
              </span>
            </div>
            <div className="relative mt-5 h-1 w-full rounded-full bg-white/10">
              <div className="h-full w-1/3 rounded-full bg-emerald-400" />
            </div>
          </div>

          <div className="grid gap-5 p-5 sm:grid-cols-[minmax(0,1fr)_168px] sm:p-7">
            <div className="flex min-w-0 gap-4">
              <div className="flex h-28 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-100 text-slate-400 sm:h-32 sm:w-28">
                {employee.photoUrl ? (
                  <img src={employee.photoUrl} alt={`Foto de ${employee.name}`} className="h-full w-full object-cover" />
                ) : (
                  <User className="h-10 w-10" aria-hidden="true" />
                )}
              </div>
              <div className="min-w-0">
                <p className="break-words text-lg font-bold leading-tight text-slate-950 sm:text-xl">{employee.name}</p>
                <p className="mt-1 break-words text-sm font-medium text-emerald-700">{employee.jobTitle || 'Função não informada'}</p>
                <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Matrícula</p>
                <p className="font-mono text-sm font-semibold text-slate-800">{employee.matricula || 'Não informada'}</p>
              </div>
            </div>

            <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
              {token ? (
                <QRCodeSVG value={publicUrl || `/badge/${token}`} size={132} level="M" includeMargin aria-label="QR Code para verificar o crachá" />
              ) : (
                <div className="flex h-[132px] w-[132px] items-center justify-center rounded bg-white text-slate-400">
                  <QrCode className="h-10 w-10" aria-hidden="true" />
                </div>
              )}
              <p className="mt-2 text-[10px] font-semibold text-slate-600">Escaneie para verificar</p>
              <p className="mt-0.5 text-[10px] text-slate-400">Link individual e revogável</p>
            </div>
          </div>

          <div className="grid gap-x-6 gap-y-4 border-t border-slate-100 bg-white px-5 py-5 sm:grid-cols-2 sm:px-7">
            <InfoCell icon={<CalendarDays />} label="Admissão" value={displayDate(employee.admissionDate)} />
            <InfoCell icon={<Building2 />} label="Setor" value={employee.departmentName || 'Não informado'} />
            <InfoCell icon={<BriefcaseBusiness />} label="Supervisor responsável" value={employee.supervisor?.name || 'Não informado'} />
            <InfoCell icon={<Building2 />} label="Empresa" value={employee.tenant?.name || 'CHECK-ON'} />
          </div>
        </div>

        <section className="rounded-xl border border-slate-200 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-emerald-700" aria-hidden="true" />
            <h3 className="text-sm font-semibold text-slate-900">Integrações</h3>
          </div>
          <IntegrationLine title="Integração da empresa" doneAt={employee.companyIntegrationDate} expiresAt={employee.companyIntegrationExpiresAt} />
          <IntegrationLine title="Integração do cliente" doneAt={employee.clientIntegrationDate} expiresAt={employee.clientIntegrationExpiresAt} />
        </section>

        <section className="rounded-xl border border-slate-200 p-4">
          <div className="mb-3 flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-emerald-700" aria-hidden="true" />
            <h3 className="text-sm font-semibold text-slate-900">Treinamentos</h3>
          </div>
          {!employee.trainings?.length ? (
            <p className="text-xs text-slate-500">Nenhum treinamento cadastrado.</p>
          ) : (
            <div className="space-y-2">
              {employee.trainings.map((training) => {
                const status = integrationStatus(training.expiresAt);
                return (
                  <div key={training.id || `${training.name}-${training.completedAt}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="break-words text-xs font-semibold text-slate-800">{training.name}</p>
                      <p className="mt-0.5 text-[11px] text-slate-500">Realizado em {displayDate(training.completedAt)} · Válido até {displayDate(training.expiresAt)}</p>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${status.className}`}>{status.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Button type="button" variant="outline" onClick={onClose}>Fechar</Button>
          <div className="flex flex-col gap-2 sm:flex-row">
            {token && (
              <>
                <Button type="button" variant="outline" onClick={copyLink}>
                  {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                  {copied ? 'Link copiado' : 'Copiar link'}
                </Button>
                <Button type="button" variant="outline" onClick={() => window.open(publicUrl, '_blank', 'noopener,noreferrer')}>
                  <ExternalLink className="mr-2 h-4 w-4" /> Abrir página pública
                </Button>
              </>
            )}
            <Button type="button" onClick={rotateToken} disabled={working}>
              <QrCode className="mr-2 h-4 w-4" />
              {working ? 'Gerando…' : token ? 'Revogar e gerar QR' : 'Gerar QR do crachá'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InfoCell({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-start gap-2.5">
      <span className="mt-0.5 text-slate-400 [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
        <p className="mt-0.5 break-words text-xs font-medium text-slate-700">{value}</p>
      </div>
    </div>
  );
}

function buildPayload(data: EmployeeFormData) {
  return {
    name: data.name.trim(),
    matricula: data.matricula.trim(),
    jobTitle: data.jobTitle,
    admissionDate: data.admissionDate,
    departmentName: data.departmentName.trim() || null,
    supervisorId: data.supervisorId || null,
    companyIntegrationDate: data.companyIntegrationDate || null,
    companyIntegrationExpiresAt: data.companyIntegrationExpiresAt || null,
    clientIntegrationDate: data.clientIntegrationDate || null,
    clientIntegrationExpiresAt: data.clientIntegrationExpiresAt || null,
    trainings: data.trainings
      .filter((training) => training.name.trim())
      .map((training) => ({
        name: training.name.trim(),
        completedAt: training.completedAt,
        expiresAt: training.expiresAt || null,
      })),
  };
}

async function uploadEmployeePhoto(employeeId: string, file: File) {
  const body = new FormData();
  body.append('file', file);
  await api.post(`/employees/${employeeId}/photo`, body);
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [editTarget, setEditTarget] = useState<Employee | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [badgeTarget, setBadgeTarget] = useState<Employee | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');

  useEffect(() => { void fetchEmployees(); }, []);

  async function fetchEmployees() {
    try {
      setLoading(true);
      const response = await api.get<Employee[]>('/employees');
      setEmployees(response.data);
    } catch {
      alert('Não foi possível carregar a relação de colaboradores.');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(data: EmployeeFormData) {
    let created: Employee | null = null;
    try {
      setCreateSubmitting(true);
      const response = await api.post<Employee>('/employees', buildPayload(data));
      created = response.data;
      if (data.photoFile) await uploadEmployeePhoto(created.id, data.photoFile);
      setCreateOpen(false);
      await fetchEmployees();
    } catch {
      if (created) {
        setCreateOpen(false);
        await fetchEmployees();
        alert('O colaborador foi cadastrado e o crachá gerado, mas a foto não foi enviada. Edite o cadastro para tentar novamente.');
      } else {
        alert('Não foi possível cadastrar o colaborador. Verifique matrícula e dados obrigatórios.');
      }
    } finally {
      setCreateSubmitting(false);
    }
  }

  async function handleEdit(data: EmployeeFormData) {
    if (!editTarget) return;
    let updated: Employee | null = null;
    try {
      setEditSubmitting(true);
      const response = await api.patch<Employee>(`/employees/${editTarget.id}`, buildPayload(data));
      updated = response.data;
      if (data.photoFile) await uploadEmployeePhoto(editTarget.id, data.photoFile);
      setEditTarget(null);
      await fetchEmployees();
      if (badgeTarget?.id === editTarget.id) {
        setBadgeTarget({ ...badgeTarget, ...updated });
      }
    } catch {
      if (updated) {
        setEditTarget(null);
        await fetchEmployees();
        alert('Os dados foram salvos, mas a foto não foi enviada. Tente atualizar a foto novamente.');
      } else {
        alert('Não foi possível atualizar o colaborador.');
      }
    } finally {
      setEditSubmitting(false);
    }
  }

  async function handleToggleActive(employee: Employee) {
    const action = employee.isActive ? 'inativar' : 'reativar';
    if (!window.confirm(`Deseja ${action} ${employee.name}? A página pública do crachá ficará indisponível enquanto estiver inativo.`)) return;
    try {
      await api.patch(`/employees/${employee.id}`, { isActive: !employee.isActive });
      await fetchEmployees();
    } catch {
      alert('Não foi possível alterar a situação do colaborador.');
    }
  }

  const roleLabelMap = Object.fromEntries(EMPLOYEE_ROLES.map((role) => [role.value, role.label]));
  const filteredEmployees = employees.filter((employee) => {
    const job = employee.jobTitle || '';
    const matchesSearch = employee.name.toLowerCase().includes(search.toLowerCase())
      || (employee.matricula || '').toLowerCase().includes(search.toLowerCase())
      || (employee.departmentName || '').toLowerCase().includes(search.toLowerCase());
    return matchesSearch && (roleFilter === 'ALL' || job === roleFilter);
  });

  const formFromEmployee = (employee: Employee): EmployeeFormData => ({
    ...EMPTY_FORM,
    name: employee.name,
    matricula: employee.matricula || '',
    jobTitle: employee.jobTitle || 'MOTORISTA',
    admissionDate: dateInput(employee.admissionDate) || today(),
    departmentName: employee.departmentName || '',
    supervisorId: employee.supervisorId || '',
    companyIntegrationDate: dateInput(employee.companyIntegrationDate),
    companyIntegrationExpiresAt: dateInput(employee.companyIntegrationExpiresAt),
    clientIntegrationDate: dateInput(employee.clientIntegrationDate),
    clientIntegrationExpiresAt: dateInput(employee.clientIntegrationExpiresAt),
    trainings: (employee.trainings || []).map((training: EmployeeTraining) => ({
      name: training.name,
      completedAt: dateInput(training.completedAt),
      expiresAt: dateInput(training.expiresAt),
    })),
    photoFile: null,
    photoUrl: employee.photoUrl || '',
  });

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Colaboradores</h1>
          <p className="mt-1 text-sm text-slate-500">Cadastros, treinamentos e crachás digitais com validade conferível por QR.</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger>
            <Button className="w-full shrink-0 shadow-sm sm:w-auto">
              <Plus className="mr-2 h-4 w-4" aria-hidden="true" /> Cadastrar colaborador
            </Button>
          </DialogTrigger>
          <DialogContent className="w-[calc(100vw-2rem)] max-w-none max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>Novo colaborador</DialogTitle>
              <DialogDescription>O crachá virtual e o QR individual são gerados no cadastro.</DialogDescription>
            </DialogHeader>
            <EmployeeForm
              mode="create"
              supervisors={employees}
              submitting={createSubmitting}
              onSubmit={handleCreate}
              onCancel={() => setCreateOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="flex flex-col gap-3 border-b border-slate-100 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base font-semibold text-slate-700">Relação de colaboradores</CardTitle>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" aria-hidden="true" />
              <Input
                type="search"
                placeholder="Buscar nome, matrícula ou setor…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="h-9 bg-slate-50 pl-9 text-sm"
                aria-label="Buscar colaboradores"
              />
            </div>
            <Select value={roleFilter} onValueChange={(value) => setRoleFilter(value || 'ALL')}>
              <SelectTrigger className="h-9 w-full bg-slate-50 text-xs sm:w-44">
                <SelectValue placeholder="Todas as funções" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todas as funções</SelectItem>
                {EMPLOYEE_ROLES.map((role) => <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex flex-col items-center p-10 text-center text-sm text-slate-500">
              <Activity className="mb-2 h-6 w-6 animate-pulse text-emerald-600" aria-hidden="true" /> Carregando colaboradores…
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="flex flex-col items-center bg-slate-50/50 px-6 py-14 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-white text-emerald-700 shadow-sm">
                <Users className="h-7 w-7" aria-hidden="true" />
              </div>
              <h2 className="text-base font-semibold text-slate-900">{employees.length ? 'Nenhum resultado para esta busca' : 'Comece cadastrando sua equipe'}</h2>
              <p className="mt-1 max-w-md text-sm leading-6 text-slate-500">
                {employees.length ? 'Ajuste os filtros para localizar um colaborador.' : 'Adicione foto, função, setor, responsável, treinamentos e validade das integrações.'}
              </p>
              {!employees.length && <Button className="mt-4" onClick={() => setCreateOpen(true)}><Plus className="mr-2 h-4 w-4" /> Cadastrar colaborador</Button>}
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50/70">
                <TableRow>
                  <TableHead className="min-w-56">Colaborador</TableHead>
                  <TableHead>Matrícula</TableHead>
                  <TableHead>Função / setor</TableHead>
                  <TableHead>Validade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees.map((employee) => {
                  const role = employee.jobTitle || '';
                  const companyStatus = integrationStatus(employee.companyIntegrationExpiresAt);
                  const clientStatus = integrationStatus(employee.clientIntegrationExpiresAt);
                  const hasExpiredIntegration = companyStatus.label === 'Vencida' || clientStatus.label === 'Vencida';
                  const hasExpiringIntegration = companyStatus.label === 'Vence em breve' || clientStatus.label === 'Vence em breve';
                  return (
                    <TableRow key={employee.id}>
                      <TableCell>
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 text-slate-400">
                            {employee.photoUrl ? <img src={employee.photoUrl} alt="" className="h-full w-full object-cover" /> : <User className="h-5 w-5" aria-hidden="true" />}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-slate-900">{employee.name}</p>
                            <p className="mt-0.5 truncate text-xs text-slate-500">{employee.departmentName || 'Setor não informado'}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="whitespace-nowrap rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono text-xs font-semibold text-slate-700">
                          {employee.matricula || '—'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Badge variant="outline" className={ROLE_COLOR[role] || 'border-slate-200 bg-slate-50 text-slate-600'}>
                            {roleLabelMap[role] || role || 'Não definida'}
                          </Badge>
                          <p className="text-xs text-slate-500">{employee.departmentName || 'Setor não informado'}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {hasExpiredIntegration ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-700"><AlertTriangle className="h-3.5 w-3.5" /> Integração vencida</span>
                        ) : hasExpiringIntegration ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700"><Clock3 className="h-3.5 w-3.5" /> Vence em breve</span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs text-slate-500"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> {employee.companyIntegrationExpiresAt || employee.clientIntegrationExpiresAt ? 'Em dia' : 'Sem validade'}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={employee.isActive ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-500'}>
                          {employee.isActive ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-9 w-9 text-emerald-700 hover:bg-emerald-50" aria-label={`Abrir crachá de ${employee.name}`} onClick={() => setBadgeTarget(employee)}>
                            <QrCode className="h-4 w-4" aria-hidden="true" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-500" aria-label={`Editar ${employee.name}`} onClick={() => setEditTarget(employee)}>
                            <Edit2 className="h-4 w-4" aria-hidden="true" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className={`h-9 w-9 ${employee.isActive ? 'text-slate-400 hover:bg-amber-50 hover:text-amber-700' : 'text-emerald-700 hover:bg-emerald-50'}`}
                            aria-label={employee.isActive ? `Inativar ${employee.name}` : `Reativar ${employee.name}`}
                            onClick={() => handleToggleActive(employee)}
                          >
                            {employee.isActive ? <ShieldOff className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {editTarget && (
        <Dialog open onOpenChange={(open) => !open && setEditTarget(null)}>
          <DialogContent className="w-[calc(100vw-2rem)] max-w-none max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>Editar colaborador</DialogTitle>
              <DialogDescription>Atualize o cadastro e as informações que aparecem no crachá de {editTarget.name}.</DialogDescription>
            </DialogHeader>
            <EmployeeForm
              mode="edit"
              initial={formFromEmployee(editTarget)}
              supervisors={employees}
              currentEmployeeId={editTarget.id}
              submitting={editSubmitting}
              onSubmit={handleEdit}
              onCancel={() => setEditTarget(null)}
            />
          </DialogContent>
        </Dialog>
      )}

      {badgeTarget && (
        <BadgeDialog
          employee={badgeTarget}
          onClose={() => setBadgeTarget(null)}
          onEmployeeUpdate={(updated) => {
            setBadgeTarget(updated);
            setEmployees((current) => current.map((employee) => employee.id === updated.id ? updated : employee));
          }}
        />
      )}
    </>
  );
}
