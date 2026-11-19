import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { api } from './api';

/** A API aceita até 4 MB. 1600 px no lado maior com JPEG 70% fica bem abaixo disso. */
const MAX_SIDE = 1600;

function photosDir(): Directory {
  // Pasta de documentos (não é apagada pelo sistema como o cache): a foto precisa durar até ser enviada.
  const dir = new Directory(Paths.document, 'inspection-photos');
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

/** Reduz a foto e guarda uma cópia permanente no aparelho. Devolve o file:// da cópia. */
export async function keepPhoto(asset: { uri: string; width: number; height: number }): Promise<string> {
  const context = ImageManipulator.ImageManipulator.manipulate(asset.uri);
  if (asset.width > MAX_SIDE || asset.height > MAX_SIDE) {
    context.resize(asset.width >= asset.height ? { width: MAX_SIDE } : { height: MAX_SIDE });
  }
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ compress: 0.7, format: ImageManipulator.SaveFormat.JPEG });
  const source = new File(saved.uri);
  const target = new File(photosDir(), `${Crypto.randomUUID()}.jpg`);
  source.moveSync(target);
  return target.uri;
}

export class CameraPermissionError extends Error {}

/** Abre a câmera. Devolve null se a pessoa cancelar. */
export async function takePhoto(): Promise<string | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    throw new CameraPermissionError('Libere o acesso à câmera nas configurações do celular para tirar a foto.');
  }
  const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8, exif: false });
  if (result.canceled || !result.assets?.length) return null;
  return keepPhoto(result.assets[0]);
}

/**
 * Android com pouca memória pode fechar o app enquanto a câmera está aberta.
 * Ao voltar, a foto tirada fica aqui.
 */
export async function recoverPendingPhoto(): Promise<string | null> {
  try {
    const result = await ImagePicker.getPendingResultAsync();
    if (!result || !('assets' in result) || result.canceled || !result.assets?.length) return null;
    return keepPhoto(result.assets[0]);
  } catch {
    return null;
  }
}

/** Envia a foto para a API e devolve o endereço que vai na resposta do item. */
export async function uploadPhoto(localUri: string): Promise<string> {
  const form = new FormData();
  // Formato de arquivo do React Native para multipart.
  form.append('file', { uri: localUri, name: 'foto.jpg', type: 'image/jpeg' } as unknown as Blob);
  const { photoUrl } = await api<{ photoUrl: string }>('/checklists/photos', { method: 'POST', form });
  return photoUrl;
}

export function deletePhoto(localUri?: string) {
  if (!localUri) return;
  try {
    const file = new File(localUri);
    if (file.exists) file.delete();
  } catch {
    // Arquivo já removido: nada a fazer.
  }
}

/** Apaga fotos que não pertencem a nenhuma inspeção guardada (ex.: foto refeita ou rascunho descartado). */
export function cleanOrphanPhotos(inUseUris: string[]) {
  // Compara pelo nome do arquivo: o mesmo arquivo pode aparecer como file:/ ou file:///.
  const inUse = new Set(inUseUris.map((uri) => uri.split('/').pop()));
  try {
    for (const entry of photosDir().list()) {
      if (entry instanceof File && !inUse.has(entry.name)) entry.delete();
    }
  } catch {
    // Limpeza é só economia de espaço; falhar aqui não atrapalha nada.
  }
}
