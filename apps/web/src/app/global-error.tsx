'use client';

import { ErrorFallback } from '@/components/error-fallback';
import './globals.css';

// Último recurso: erro no layout raiz. Precisa desenhar o próprio <html> e <body>.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="pt-BR" translate="no" className="notranslate">
      <body className="bg-slate-50 font-sans antialiased">
        <ErrorFallback error={error} reset={reset} />
      </body>
    </html>
  );
}
