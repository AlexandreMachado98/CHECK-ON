import { describe, expect, it, beforeAll } from 'vitest';
import { StorageService } from './storage.service';
import { PhotoUrlInterceptor } from './photo-url.interceptor';
import { of, lastValueFrom } from 'rxjs';

const TENANT = '11111111-2222-3333-4444-555555555555';
const UUID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

describe('fotos servidas pela API', () => {
  let storage: StorageService;
  beforeAll(() => {
    // Endereço "público" que o navegador não consegue abrir (o problema visto em produção).
    process.env.PUBLIC_API_URL = 'https://armazenamento-inacessivel.invalid';
    process.env.STORAGE_DRIVER = 'local';
    storage = new StorageService();
  });
  const stored = `https://armazenamento-inacessivel.invalid/uploads/checklist-photos/${TENANT}/${UUID}.jpg`;

  it('mostra a foto pela rota /fotos da API', () => {
    expect(storage.displayUrl(stored, 'https://check-on-mu.vercel.app/api')).toBe(
      `https://check-on-mu.vercel.app/api/fotos/checklist-photos/${TENANT}/${UUID}.jpg`,
    );
  });
  it('reconhece foto gravada com outro endereço de armazenamento (endereço antigo)', () => {
    const old = `https://pub-antigo.r2.dev/checklist-photos/${TENANT}/${UUID}.jpg`;
    expect(storage.displayUrl(old, 'https://x/api')).toBe(`https://x/api/fotos/checklist-photos/${TENANT}/${UUID}.jpg`);
  });

  it('não mexe em endereços que não são do armazenamento', () => {
    expect(storage.displayUrl('https://outro.site/foto.jpg', 'https://x/api')).toBe('https://outro.site/foto.jpg');
  });
  it('o app pode devolver o endereço /fotos: continua valendo e é gravado no formato do armazenamento', () => {
    const display = `https://check-on-mu.vercel.app/api/fotos/checklist-photos/${TENANT}/${UUID}.jpg`;
    expect(storage.isChecklistPhotoUrl(display, TENANT)).toBe(true);
    expect(storage.isChecklistPhotoUrl(display, 'outra-empresa')).toBe(false);
    expect(storage.canonicalUrl(display)).toBe(stored);
  });
  it('a rota /fotos não aceita caminhos fora das pastas de foto', async () => {
    for (const key of ['../.env', 'checklist-photos/x/../../segredo.jpg', 'outra-pasta/a.jpg', `checklist-photos/${TENANT}/nome.jpg`]) {
      await expect(storage.getPhoto(key)).resolves.toBeNull();
    }
  });
  it('o interceptor troca todo campo photoUrl da resposta, inclusive aninhado', async () => {
    const interceptor = new PhotoUrlInterceptor(storage);
    const req = { protocol: 'https', get: () => 'check-on-mu.vercel.app' };
    const context = { getType: () => 'http', switchToHttp: () => ({ getRequest: () => req }) } as never;
    process.env.VERCEL = '1';
    const out = (await lastValueFrom(
      interceptor.intercept(context, { handle: () => of({ answers: [{ photoUrl: stored, textValue: stored }], employee: { photoUrl: null } }) }),
    )) as { answers: Array<{ photoUrl: string; textValue: string }>; employee: { photoUrl: null } };
    delete process.env.VERCEL;
    expect(out.answers[0].photoUrl).toBe(`https://check-on-mu.vercel.app/api/fotos/checklist-photos/${TENANT}/${UUID}.jpg`);
    expect(out.answers[0].textValue).toBe(stored); // só campos photoUrl
    expect(out.employee.photoUrl).toBeNull();
  });
});
