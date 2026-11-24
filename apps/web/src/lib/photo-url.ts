/** Larguras que a API entrega já reduzidas (precisa bater com PHOTO_WIDTHS da API). */
export type PhotoWidth = 320 | 900;

// Fotos de inspeção em JPEG/WebP (as assinaturas são PNG transparente e ficam de fora)
// e fotos de colaborador em qualquer formato aceito.
const RESIZABLE = /\/fotos\/(checklist-photos\/[A-Za-z0-9-]+\/[0-9a-f-]{36}\.(jpg|webp)|employee-photos\/[0-9a-f-]{36}\.(jpg|png|webp))$/;

/**
 * Endereço da foto (inspeção ou colaborador) numa largura menor (miniatura na tela, 900 px no PDF).
 * Assinaturas (PNG transparente) e endereços de fora da API ficam como estão.
 */
export function photoAtWidth(url: string, width: PhotoWidth): string {
  return RESIZABLE.test(url) ? `${url}?w=${width}` : url;
}
