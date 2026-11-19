'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Clock } from 'lucide-react';
import api from '@/lib/api';

type Subscription = {
  state: 'ATIVA' | 'TESTE' | 'CARENCIA' | 'VENCIDA' | 'SUSPENSA';
  endsAt: string | null;
  graceEndsAt: string | null;
  daysLeft: number | null;
};

function day(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

/** Texto do aviso, ou null quando não há o que avisar. Exportado para teste. */
export function subscriptionNotice(s: Subscription | null | undefined): { tone: 'warning' | 'danger'; text: string } | null {
  if (!s || !s.endsAt || s.daysLeft === null) return null;
  if (s.state === 'CARENCIA') {
    return {
      tone: 'danger',
      text: `A assinatura do CHECK-ON venceu em ${day(s.endsAt)}. O acesso ao portal e ao aplicativo será bloqueado em ${day(s.graceEndsAt)} se não for renovada.`,
    };
  }
  if ((s.state === 'ATIVA' || s.state === 'TESTE') && s.daysLeft <= 7) {
    const when = s.daysLeft <= 0 ? 'hoje' : s.daysLeft === 1 ? 'amanhã' : `em ${s.daysLeft} dias`;
    return s.state === 'TESTE'
      ? { tone: 'warning', text: `O período de teste do CHECK-ON termina ${when} (${day(s.endsAt)}). Fale com o CHECK-ON para contratar.` }
      : { tone: 'warning', text: `A assinatura do CHECK-ON vence ${when} (${day(s.endsAt)}). Fale com o CHECK-ON para renovar.` };
  }
  return null;
}

/** Aviso de vencimento no topo do portal (assinatura controlada pelo DDS Master). */
export function SubscriptionBanner() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);

  useEffect(() => {
    let alive = true;
    api.get<{ subscription?: Subscription }>('/auth/me')
      .then((res) => alive && setSubscription(res.data.subscription ?? null))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const notice = subscriptionNotice(subscription);
  if (!notice) return null;
  const danger = notice.tone === 'danger';
  return (
    <div
      role="alert"
      data-testid="subscription-banner"
      className={`mb-4 flex items-start gap-3 rounded-lg border p-3 text-sm ${danger ? 'border-rose-200 bg-rose-50 text-rose-900' : 'border-amber-200 bg-amber-50 text-amber-900'}`}
    >
      {danger ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> : <Clock className="mt-0.5 h-4 w-4 shrink-0" />}
      <p>{notice.text}</p>
    </div>
  );
}
