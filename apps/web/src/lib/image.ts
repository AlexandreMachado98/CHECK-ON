/**
 * Reduz a foto no navegador antes de enviar (lado maior até 1600 px, JPEG 75%):
 * fotos de celular passam fácil dos 4 MB que a API aceita.
 */
export async function shrinkImage(file: File, maxSide = 1600, quality = 0.75): Promise<File> {
  if (!file.type.startsWith('image/')) throw new Error('Escolha um arquivo de imagem.');
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions).catch(() => null);
  if (!bitmap) return file; // formato que o navegador não abre: tenta enviar como está
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
  if (!blob) return file;
  return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
}
