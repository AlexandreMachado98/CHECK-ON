'use client';

import { useState, useSyncExternalStore } from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

/**
 * Avisos e confirmações do próprio portal, no lugar de alert() e window.confirm() do navegador
 * (que mostram "o site diz…", travam a página e destoam do resto, principalmente no celular).
 * Uso: notify('Mensagem') e `if (!(await confirmAction({ message: '...' }))) return;`.
 * O <FeedbackHost /> fica no layout do painel e desenha os dois.
 */

type Tone = 'error' | 'success' | 'info';
type Notice = { id: number; text: string; tone: Tone };
type ConfirmRequest = {
  title: string;
  message: string;
  confirmLabel: string;
  danger: boolean;
  resolve: (ok: boolean) => void;
};

let notices: Notice[] = [];
let pending: ConfirmRequest | null = null;
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** Mostra um aviso no canto da tela. Erros ficam mais tempo; todos podem ser fechados. */
export function notify(text: string, tone: Tone = 'error') {
  const id = nextId++;
  notices = [...notices.slice(-3), { id, text, tone }];
  emit();
  setTimeout(() => dismiss(id), tone === 'error' ? 9000 : 5000);
}

function dismiss(id: number) {
  if (!notices.some((n) => n.id === id)) return;
  notices = notices.filter((n) => n.id !== id);
  emit();
}

/** Pede confirmação. Resolve true se a pessoa confirmar; false se cancelar ou fechar. */
export function confirmAction(options: { message: string; title?: string; confirmLabel?: string; danger?: boolean }): Promise<boolean> {
  pending?.resolve(false);
  return new Promise((resolve) => {
    pending = {
      title: options.title ?? 'Confirmar',
      message: options.message,
      confirmLabel: options.confirmLabel ?? 'Confirmar',
      danger: options.danger ?? false,
      resolve,
    };
    emit();
  });
}

function answer(ok: boolean) {
  const current = pending;
  pending = null;
  emit();
  current?.resolve(ok);
}

const TONE: Record<Tone, { box: string; icon: typeof Info }> = {
  error: { box: 'border-rose-200 bg-rose-50 text-rose-900', icon: AlertTriangle },
  success: { box: 'border-emerald-200 bg-emerald-50 text-emerald-900', icon: CheckCircle2 },
  info: { box: 'border-slate-200 bg-white text-slate-800', icon: Info },
};

export function FeedbackHost() {
  const list = useSyncExternalStore(subscribe, () => notices, () => notices);
  const request = useSyncExternalStore(subscribe, () => pending, () => pending);
  // Guarda o último pedido para o texto não sumir durante a animação de fechar.
  const [shown, setShown] = useState<ConfirmRequest | null>(null);
  if (request && request !== shown) setShown(request);

  return (
    <>
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-[60] flex flex-col items-stretch gap-2 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-96"
      >
        {list.map((n) => {
          const { box, icon: Icon } = TONE[n.tone];
          return (
            <div key={n.id} role={n.tone === 'error' ? 'alert' : 'status'} className={`pointer-events-auto flex items-start gap-3 rounded-lg border p-3 text-sm shadow-lg ${box}`}>
              <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <p className="flex-1 whitespace-pre-line">{n.text}</p>
              <button type="button" onClick={() => dismiss(n.id)} className="rounded p-0.5 opacity-60 hover:opacity-100" aria-label="Fechar aviso">
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>

      <Dialog open={!!request} onOpenChange={(open) => !open && answer(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{shown?.title}</DialogTitle>
            <DialogDescription className="whitespace-pre-line">{shown?.message}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => answer(false)}>Cancelar</Button>
            <Button
              className={shown?.danger ? 'bg-rose-600 text-white hover:bg-rose-700' : undefined}
              onClick={() => answer(true)}
            >
              {shown?.confirmLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
