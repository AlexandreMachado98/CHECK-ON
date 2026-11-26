import type { Metadata, Viewport } from 'next';
import FollowSuggestion from './follow';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Acompanhar sugestão | CHECK-ON',
  robots: { index: false, follow: false, noarchive: true },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#047857' };

// Link do protocolo da sugestão (passageiro, sem login).
export default async function SuggestionFollowPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <FollowSuggestion token={token} />;
}
