import type { ReactNode } from 'react';
import { ClipboardCheck } from 'lucide-react';

/** Logo do CHECK-ON usada nas telas de acesso (sobre o fundo escuro). */
export function AuthLogo({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500 text-white shadow-lg shadow-emerald-500/20">
        <ClipboardCheck className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="text-lg font-semibold tracking-tight text-white">CHECK-ON</span>
    </div>
  );
}

/**
 * Fundo das telas de acesso: azul-noite com duas manchas de luz verde que se deslocam devagar
 * e uma grade fina em movimento lento. Quem pediu "reduzir movimento" no sistema vê tudo parado.
 */
function AuthBackground() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,theme(colors.slate.900),theme(colors.slate.950)_70%)]" />
      <div className="absolute -left-40 -top-40 h-[34rem] w-[34rem] rounded-full bg-emerald-500/20 blur-3xl animate-aurora-a motion-reduce:animate-none" />
      <div className="absolute -bottom-48 -right-32 h-[38rem] w-[38rem] rounded-full bg-teal-400/10 blur-3xl animate-aurora-b motion-reduce:animate-none" />
      <div className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(theme(colors.white)_1px,transparent_1px),linear-gradient(90deg,theme(colors.white)_1px,transparent_1px)] [background-size:48px_48px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)] animate-grid-drift motion-reduce:animate-none" />
    </div>
  );
}

/**
 * Moldura das telas de acesso (login, esqueci a senha, troca de senha).
 * Com `intro`, no computador a apresentação fica à esquerda e o cartão à direita; no celular o
 * cartão vem primeiro (quem abre o login quer entrar) e a apresentação logo abaixo.
 */
export function AuthShell({ children, intro }: { children: ReactNode; intro?: ReactNode }) {
  return (
    <div className="relative flex min-h-dvh w-full flex-col bg-slate-950 text-slate-300">
      <AuthBackground />
      <main
        className={`relative mx-auto flex w-full flex-1 flex-col items-center px-4 pb-10 pt-12 sm:px-6 lg:justify-center lg:py-16 ${
          intro ? 'max-w-6xl lg:grid lg:grid-cols-[1fr_400px] lg:items-center lg:gap-16 xl:gap-24' : 'max-w-md sm:justify-center'
        }`}
      >
        {intro && (
          <section className="order-2 mt-12 w-full max-w-xl lg:order-1 lg:mt-0">
            <AuthLogo className="mb-10 hidden lg:flex" />
            {intro}
          </section>
        )}
        <div className="order-1 w-full max-w-[400px] lg:order-2">
          <AuthLogo className={`mb-8 justify-center ${intro ? 'lg:hidden' : ''}`} />
          <div className="rounded-2xl border border-white/10 bg-white p-6 text-slate-900 shadow-2xl shadow-black/40 sm:p-8">{children}</div>
        </div>
      </main>
      <footer className="relative pb-6 text-center text-xs text-slate-500">© {new Date().getFullYear()} CHECK-ON</footer>
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

/** Apresentação do sistema ao lado do login: texto corrido, sem chamadas de venda. */
export function LoginIntro() {
  const steps = [
    {
      title: 'No pátio',
      text: 'O motorista lê o QR Code do veículo e responde o checklist no celular, com fotos. Onde não há sinal, a inspeção fica guardada no aparelho e segue sozinha quando a conexão volta.',
    },
    {
      title: 'Na oficina',
      text: 'Cada item reprovado vira uma não conformidade. Se for crítico, o veículo fica bloqueado até alguém registrar a correção, com descrição, foto e nome de quem resolveu.',
    },
    {
      title: 'No escritório',
      text: 'Cada veículo guarda o próprio histórico: inspeções, defeitos que voltaram a aparecer e tudo o que foi feito para resolver. Fica fácil explicar uma decisão ou passar por uma auditoria.',
    },
  ];
  return (
    <div>
      <h2 className="text-2xl font-semibold leading-snug tracking-tight text-white sm:text-3xl">
        A rotina de inspeção da sua frota, do pátio ao escritório.
      </h2>
      <p className="mt-4 text-[15px] leading-relaxed text-slate-400">
        O CHECK-ON foi pensado para quem cuida de veículos no dia a dia. Quem está em campo registra o que viu;
        quem está na gestão enxerga o mesmo retrato, no mesmo momento, e decide o que pode rodar.
      </p>
      <ol className="mt-10 space-y-6 border-l border-white/10 pl-6">
        {steps.map((step) => (
          <li key={step.title} className="relative">
            <span className="absolute -left-[29px] top-1.5 h-2 w-2 rounded-full bg-emerald-400 ring-4 ring-slate-950" aria-hidden="true" />
            <h3 className="text-sm font-semibold text-slate-100">{step.title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-slate-400">{step.text}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
