import type { Metadata } from 'next';
import BadgeVerification from './verification';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Verificação de crachá | CHECK-ON',
  robots: { index: false, follow: false, noarchive: true },
};

// Next 15+: os parâmetros da rota chegam como Promise.
export default async function BadgePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <BadgeVerification token={token} />;
}
