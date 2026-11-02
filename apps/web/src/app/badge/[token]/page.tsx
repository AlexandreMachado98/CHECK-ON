import type { Metadata } from 'next';
import BadgeVerification from './verification';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Verificação de crachá | CHECK-ON',
  robots: { index: false, follow: false, noarchive: true },
};

export default function BadgePage({ params }: { params: { token: string } }) {
  return <BadgeVerification token={params.token} />;
}
