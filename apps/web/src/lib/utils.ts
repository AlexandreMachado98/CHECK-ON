export { cn } from "cn"

/** Km no formato brasileiro ("123.456 km"); vazio sem leitura. */
export function formatKm(km?: number | null): string {
  return km == null ? '' : `${km.toLocaleString('pt-BR')} km`;
}
