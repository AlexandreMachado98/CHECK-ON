'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Props = {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  /** Nome do item no plural, para o texto "1–50 de 320 inspeções". */
  noun?: string;
};

/** Navegação de páginas das listas longas (Inspeções, NCs). */
export function Pagination({ page, pageSize, total, onPageChange, noun = 'registros' }: Props) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  return (
    <div className="flex flex-col items-center justify-between gap-2 border-t border-slate-100 px-4 py-3 text-xs text-slate-500 sm:flex-row">
      <span>
        {first}–{last} de {total} {noun}
      </span>
      {pages > 1 && (
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8" disabled={page <= 1} onClick={() => onPageChange(page - 1)} aria-label="Página anterior">
            <ChevronLeft className="h-4 w-4" />
            Anterior
          </Button>
          <span className="tabular-nums">
            {page} / {pages}
          </span>
          <Button variant="outline" size="sm" className="h-8" disabled={page >= pages} onClick={() => onPageChange(page + 1)} aria-label="Próxima página">
            Próxima
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
