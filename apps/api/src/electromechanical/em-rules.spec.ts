import { describe, expect, it } from 'vitest';
import { addDaysIso, effectiveVehicleStatus, emStatus } from './em-rules';

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);
const today = '2026-11-26';

describe('Inspeção eletromecânica — situação', () => {
  it('em dia, vence em breve (15 dias) e vencida a partir do dia seguinte', () => {
    expect(emStatus(d('2027-03-10'), null, today)).toMatchObject({ state: 'EM_DIA', daysLeft: 104 });
    expect(emStatus(d('2026-12-11'), null, today)).toMatchObject({ state: 'VENCE_EM_BREVE', daysLeft: 15 });
    expect(emStatus(d('2026-11-26'), null, today)).toMatchObject({ state: 'VENCE_EM_BREVE', daysLeft: 0 });
    expect(emStatus(d('2026-11-25'), null, today)).toMatchObject({ state: 'VENCIDA', daysLeft: -1 });
  });

  it('vencida com liberação provisória vigente fica liberada; liberação passada não vale', () => {
    expect(emStatus(d('2026-11-20'), d('2026-11-30'), today)).toMatchObject({ state: 'LIBERADA', releasedUntil: '2026-11-30' });
    expect(emStatus(d('2026-11-20'), d('2026-11-26'), today).state).toBe('LIBERADA');
    expect(emStatus(d('2026-11-20'), d('2026-11-25'), today)).toMatchObject({ state: 'VENCIDA', releasedUntil: null });
  });

  it('sem registro não bloqueia; vencida bloqueia por cima de qualquer situação', () => {
    expect(emStatus(null, null, today).state).toBe('SEM_REGISTRO');
    expect(effectiveVehicleStatus('LIBERADO', emStatus(null, null, today))).toBe('LIBERADO');
    expect(effectiveVehicleStatus('LIBERADO', emStatus(d('2026-11-25'), null, today))).toBe('BLOQUEADO');
    expect(effectiveVehicleStatus('ATENCAO', emStatus(d('2026-11-20'), d('2026-11-30'), today))).toBe('ATENCAO');
    expect(addDaysIso('2026-11-26', 30)).toBe('2026-12-26');
  });
});

describe('Inspeção eletromecânica — SQL do bloqueio', () => {
  it('sem validade registrada a condição é falsa (não NULL): o veículo segue nas contagens', async () => {
    const { sqlEmBlocked } = await import('./em-rules');
    const sql = sqlEmBlocked('v', '2026-11-26');
    expect(sql.sql).toContain('v."emExpiresAt" IS NOT NULL AND v."emExpiresAt" <');
    expect(sql.values).toEqual(['2026-11-26', '2026-11-26']);
  });
});
