'use client';

import { ErrorFallback } from '@/components/error-fallback';

// Erros dentro do painel ficam aqui: o menu lateral continua na tela.
export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorFallback error={error} reset={reset} />;
}
