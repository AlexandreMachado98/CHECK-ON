import { ClsServiceManager } from 'nestjs-cls';

type TenantReader = {
  tenant: { findUnique(args: { where: { id: string }; select: { autoBlockCriticalNc: true } }): Promise<{ autoBlockCriticalNc: boolean } | null> };
};

/**
 * Configuração da empresa "NC crítica bloqueia o veículo". Na falta da empresa no contexto,
 * mantém o comportamento seguro (bloquear).
 */
export async function autoBlockCriticalNc(client: TenantReader, tenantId?: string | null): Promise<boolean> {
  const id = tenantId ?? ClsServiceManager.getClsService()?.get<string>('tenantId');
  if (!id) return true;
  const tenant = await client.tenant.findUnique({ where: { id }, select: { autoBlockCriticalNc: true } });
  return tenant?.autoBlockCriticalNc ?? true;
}
