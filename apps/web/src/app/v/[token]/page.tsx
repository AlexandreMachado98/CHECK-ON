import type { Metadata, Viewport } from 'next';
import PassengerPage from './passenger';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Como estou dirigindo? | CHECK-ON',
  robots: { index: false, follow: false, noarchive: true },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#047857' };

// Página aberta pelo QR Code de dentro do veículo (passageiro, sem login).
export default async function VehiclePassengerPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <PassengerPage token={token} />;
}
