import type { ReactNode } from 'react';
import { ClipboardCheck } from 'lucide-react';

/** Logo do CHECK-ON usada nas telas de acesso. */
export function AuthLogo() {
  return (
    <div className="flex items-center justify-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white">
        <ClipboardCheck className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="text-lg font-semibold tracking-tight text-slate-900">CHECK-ON</span>
    </div>
  );
}

/**
 * Moldura das telas de acesso (login, esqueci a senha, troca de senha): cartão centralizado
 * sobre fundo neutro, logo acima e rodapé discreto. No celular o formulário aparece sem rolar.
 */
export function AuthShell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="relative flex min-h-dvh w-full flex-col bg-slate-50">
      {/* Padrão de pontos bem suave, só para o fundo não ficar chapado. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 [background-image:radial-gradient(theme(colors.slate.300)_1px,transparent_1px)] [background-size:20px_20px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)] opacity-60"
      />
      <main className="relative flex flex-1 flex-col items-center justify-start px-4 pb-10 pt-14 sm:justify-center sm:py-16">
        <div className={`w-full ${wide ? 'max-w-md' : 'max-w-[400px]'}`}>
          <AuthLogo />
          <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">{children}</div>
        </div>
      </main>
      <footer className="relative pb-6 text-center text-xs text-slate-400">© {new Date().getFullYear()} CHECK-ON</footer>
    </div>
  );
}

/** Título e (opcional) uma linha de apoio no topo do cartão. */
export function AuthHeading({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-6">
      <h1 className="text-xl font-semibold tracking-tight text-slate-900">{title}</h1>
      {children && <p className="mt-1.5 text-sm text-slate-500">{children}</p>}
    </div>
  );
}
