'use client';

import { useEffect, useState } from 'react';
import { Check, Copy, KeyRound, Smartphone, MonitorSmartphone } from 'lucide-react';
import api, { ensureList } from '@/lib/api';
import { apiErrorMessage, type AccessCredentials, type Employee, type EmployeeAccess, type Role } from '@/lib/types';
import { roleLabel } from '@/lib/roles';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

/** Onde cada perfil entra: motorista só no aplicativo; os demais no portal e no aplicativo. */
export function accessChannel(roleName?: string | null): 'APP' | 'PORTAL' {
  return roleName === 'MOTORISTA' ? 'APP' : 'PORTAL';
}

/** Situação do acesso na lista de colaboradores. */
export function AccessBadge({ access }: { access?: EmployeeAccess | null }) {
  if (!access) return <span className="text-xs text-slate-400">Sem acesso</span>;
  const channel = accessChannel(access.role.name);
  const locked = access.lockedUntil && new Date(access.lockedUntil).getTime() > Date.now();
  return (
    <div className="space-y-1">
      <Badge
        variant="outline"
        className={access.isActive ? 'border-sky-200 bg-sky-50 text-sky-800' : 'border-slate-200 bg-slate-100 text-slate-500 line-through'}
        title={roleLabel(access.role.name)}
      >
        {channel === 'APP' ? <Smartphone className="mr-1 h-3 w-3" /> : <MonitorSmartphone className="mr-1 h-3 w-3" />}
        {channel === 'APP' ? 'Aplicativo' : 'Portal + App'}
      </Badge>
      <p className="text-[11px] text-slate-500">
        {!access.isActive ? 'Acesso bloqueado' : locked ? 'Bloqueado por tentativas' : access.mustChangePassword ? 'Aguardando 1º acesso' : roleLabel(access.role.name)}
      </p>
    </div>
  );
}

/** Credenciais geradas: mostradas uma única vez para a empresa entregar ao colaborador. */
export function CredentialsDialog({ name, credentials, onClose }: { name: string; credentials: AccessCredentials | null; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  if (!credentials) return null;
  const lines = [
    `Acesso CHECK-ON de ${name}`,
    credentials.companyCode && credentials.matricula ? `Empresa: ${credentials.companyCode}  |  Matrícula: ${credentials.matricula}` : null,
    credentials.email ? `Ou e-mail: ${credentials.email}` : null,
    `Senha provisória: ${credentials.temporaryPassword}`,
    'No primeiro acesso, o sistema pede para criar uma senha nova.',
  ].filter(Boolean) as string[];

  async function copy() {
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Sem permissão de área de transferência: os dados continuam visíveis para copiar à mão.
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Acesso de {name}</DialogTitle>
          <DialogDescription>
            Entregue estes dados ao colaborador. <strong>A senha provisória não será mostrada de novo.</strong>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
          {credentials.companyCode && credentials.matricula && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-slate-500">Código da empresa</p>
                <p className="font-mono text-base font-bold text-slate-900">{credentials.companyCode}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Matrícula</p>
                <p className="font-mono text-base font-bold text-slate-900">{credentials.matricula}</p>
              </div>
            </div>
          )}
          {credentials.email && (
            <div>
              <p className="text-xs text-slate-500">Ou entrar com o e-mail</p>
              <p className="font-medium text-slate-900">{credentials.email}</p>
            </div>
          )}
          <div>
            <p className="text-xs text-slate-500">Senha provisória</p>
            <p data-testid="temporary-password" className="font-mono text-lg font-bold tracking-wider text-emerald-700">{credentials.temporaryPassword}</p>
          </div>
        </div>
        <p className="text-xs text-slate-500">No primeiro acesso (aplicativo ou portal), a pessoa cria uma senha própria.</p>
        <DialogFooter>
          <Button variant="outline" onClick={copy}>
            {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
            {copied ? 'Copiado' : 'Copiar dados'}
          </Button>
          <Button onClick={onClose}>Concluir</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const ROLE_HINT: Record<string, string> = {
  MOTORISTA: 'Só aplicativo: faz as inspeções no celular.',
  SUPERVISOR: 'Portal e aplicativo: acompanha a operação, trata NCs, libera e bloqueia veículos.',
  GESTOR: 'Portal e aplicativo: cadastra frota, colaboradores e acessos.',
  ADMIN_EMPRESA: 'Portal e aplicativo: tudo, inclusive Configurações da empresa.',
};

/** "Criar acesso" para um colaborador: escolhe o perfil (onde ele entra) e, opcionalmente, um e-mail. */
export function CreateAccessDialog({
  employee,
  onClose,
  onCreated,
}: {
  employee: Employee;
  onClose: () => void;
  onCreated: (credentials: AccessCredentials) => void;
}) {
  const [roles, setRoles] = useState<Role[]>([]);
  const [roleId, setRoleId] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get<Role[]>('/roles')
      .then((res) => {
        const list = ensureList<Role>(res.data, 'perfis');
        setRoles(list);
        // Sugestão pelo cargo do colaborador.
        const suggested = list.find((r) => r.name === (employee.jobTitle === 'SUPERVISOR' ? 'SUPERVISOR' : 'MOTORISTA'));
        if (suggested) setRoleId(suggested.id);
      })
      .catch((err) => setError(apiErrorMessage(err, 'Não foi possível carregar os perfis.')));
  }, [employee.jobTitle]);

  const selected = roles.find((r) => r.id === roleId);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      setSaving(true);
      setError('');
      const res = await api.post<{ credentials: AccessCredentials }>('/users/access', {
        employeeId: employee.id,
        roleId,
        email: email.trim() || undefined,
      });
      onCreated(res.data.credentials);
    } catch (err) {
      setError(apiErrorMessage(err, 'Não foi possível criar o acesso.'));
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Criar acesso para {employee.name}</DialogTitle>
          <DialogDescription>
            O login é o código da empresa + a matrícula <strong>{employee.matricula || '(sem matrícula)'}</strong>. O sistema gera uma senha provisória.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm font-medium text-slate-800">Tipo de acesso</legend>
            {roles.map((role) => (
              <label
                key={role.id}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm ${roleId === role.id ? 'border-emerald-500 bg-emerald-50/60' : 'border-slate-200 hover:bg-slate-50'}`}
              >
                <input type="radio" name="access-role" value={role.id} checked={roleId === role.id} onChange={() => setRoleId(role.id)} className="mt-1" />
                <span>
                  <span className="font-medium text-slate-900">{role.label}</span>
                  <span className="block text-xs text-slate-500">{ROLE_HINT[role.name] ?? ''}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <div className="space-y-2">
            <Label htmlFor="access-email">E-mail (opcional)</Label>
            <Input id="access-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Se preencher, também poderá entrar com ele" autoCapitalize="none" />
          </div>
          {selected && accessChannel(selected.name) === 'APP' && (
            <p className="text-xs text-slate-500">Este colaborador não entra no portal; só no aplicativo.</p>
          )}
          {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={!roleId || saving}>
              <KeyRound className="mr-2 h-4 w-4" />
              {saving ? 'Criando...' : 'Criar acesso'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Gera uma nova senha provisória para quem esqueceu a senha. Devolve as credenciais ou null se cancelado/falhou. */
export async function resetAccessPassword(userId: string, name: string): Promise<AccessCredentials | null> {
  if (!window.confirm(`Gerar uma nova senha provisória para ${name}? A senha atual deixa de funcionar e a pessoa sai dos aparelhos conectados.`)) return null;
  try {
    const res = await api.post<{ credentials: AccessCredentials }>(`/users/${userId}/reset-password`);
    return res.data.credentials;
  } catch (err) {
    alert(apiErrorMessage(err, 'Não foi possível redefinir a senha.'));
    return null;
  }
}

/** Bloqueia ou libera o login do colaborador (aplicativo e portal). */
export async function toggleAccess(access: EmployeeAccess, name: string): Promise<boolean> {
  const question = access.isActive
    ? `Bloquear o acesso de ${name}? A pessoa sai do aplicativo e do portal em até 30 segundos.`
    : `Liberar de novo o acesso de ${name}?`;
  if (!window.confirm(question)) return false;
  try {
    await api.patch(`/users/${access.id}`, { isActive: !access.isActive });
    return true;
  } catch (err) {
    alert(apiErrorMessage(err, 'Não foi possível alterar o acesso.'));
    return false;
  }
}
