'use client';

import { useState } from 'react';
import { HardDrive } from 'lucide-react';
import api from '@/lib/api';
import { apiErrorMessage } from '@/lib/types';
import { Button } from '@/components/ui/button';

type Result = { ok: boolean; driver: string; steps: Array<{ step: string; ok: boolean; error?: string }> };

/** Teste do armazenamento das fotos (super admin): grava, lê e apaga um arquivo de teste. */
export function StorageCheckButton() {
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      setResult((await api.get<Result>('/admin/tenants/storage-check')).data);
    } catch (err) {
      setError(apiErrorMessage(err, 'Não foi possível testar o armazenamento.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button variant="outline" onClick={run} disabled={loading} data-testid="storage-check">
        <HardDrive className="mr-2 h-4 w-4" />
        {loading ? 'Testando...' : 'Testar armazenamento das fotos'}
      </Button>
      {error && <p role="alert" className="text-xs text-rose-700">{error}</p>}
      {result && (
        <div
          data-testid="storage-result"
          className={`rounded-md border p-3 text-xs ${result.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-rose-200 bg-rose-50 text-rose-900'}`}
        >
          <p className="font-semibold">{result.ok ? 'Armazenamento funcionando' : 'Problema no armazenamento'} ({result.driver})</p>
          <ul className="mt-1 space-y-0.5">
            {result.steps.map((s) => (
              <li key={s.step}>{s.ok ? '✓' : '✗'} {s.step}{s.error ? `: ${s.error}` : ''}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
