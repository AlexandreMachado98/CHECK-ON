/** Texto para busca: sem acento e sem diferença de maiúsculas ("João" e "joao" se encontram). */
export function normalizeSearch(value: string | null | undefined): string {
  return (value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** true se algum dos textos contém o termo, ignorando acentos e maiúsculas. */
export function matchesSearch(term: string, ...fields: Array<string | null | undefined>): boolean {
  const needle = normalizeSearch(term);
  if (!needle) return true;
  return fields.some((field) => normalizeSearch(field).includes(needle));
}
