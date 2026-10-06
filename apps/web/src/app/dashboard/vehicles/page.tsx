'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function VehiclesRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/fleets');
  }, [router]);

  return (
    <div className="p-12 text-center text-sm text-slate-500 flex flex-col items-center">
      <div className="h-8 w-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin mb-3" />
      Redirecionando para a Gestão Unificada de Frotas & Veículos...
    </div>
  );
}

