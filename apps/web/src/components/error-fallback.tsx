'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { isChunkLoadError, reloadOnceForNewVersion } from '@/lib/chunk-error';

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

/** Tela de erro do painel: no lugar da página em branco, explica o que houve e oferece saída. */
export function ErrorFallback({ error, reset }: Props) {
  const chunkError = isChunkLoadError(error);
  const [reloading, setReloading] = useState(false);

  useEffect(() => {
    console.error('Erro na tela do painel:', error);
    if (chunkError && reloadOnceForNewVersion()) setReloading(true);
  }, [error, chunkError]);

  if (reloading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-6 text-sm text-slate-500">
        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
        Carregando a versão mais recente do sistema...
      </div>
    );
  }

  return (
    <div className="flex min-h-[50vh] items-center justify-center p-6">
      <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm">
        <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-amber-500" />
        <h2 className="text-lg font-semibold text-slate-900">Não foi possível exibir esta tela</h2>
        <p className="mt-2 text-sm text-slate-600">
          {chunkError
            ? 'O sistema foi atualizado enquanto esta aba estava aberta. Recarregue a página para usar a versão nova.'
            : 'Ocorreu um erro inesperado. Tente de novo; se continuar, recarregue a página.'}
        </p>
        {!chunkError && error.message && (
          <details className="mt-3 text-left">
            <summary className="cursor-pointer text-xs text-slate-500">Detalhes técnicos (envie ao suporte)</summary>
            <p className="mt-1 break-words rounded bg-slate-50 p-2 font-mono text-[11px] text-slate-600">{error.message}</p>
          </details>
        )}
        {error.digest && <p className="mt-2 font-mono text-[11px] text-slate-400">Código: {error.digest}</p>}
        <div className="mt-5 flex justify-center gap-2">
          {!chunkError && (
            <button
              type="button"
              onClick={reset}
              className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Tentar de novo
            </button>
          )}
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Recarregar página
          </button>
        </div>
      </div>
    </div>
  );
}
