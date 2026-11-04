// Leitura centralizada das variáveis de ambiente.
// Em produção, a API não sobe sem as configurações de segurança obrigatórias.

const DEV_JWT_SECRET = 'dev-only-secret-change-me';

export const isProduction = () => process.env.NODE_ENV === 'production';

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
  return value;
}

export function jwtSecret(): string {
  if (isProduction()) {
    const secret = required('JWT_SECRET');
    if (secret.length < 32) throw new Error('JWT_SECRET precisa ter pelo menos 32 caracteres.');
    return secret;
  }
  return process.env.JWT_SECRET?.trim() || DEV_JWT_SECRET;
}

export function jwtExpiresIn(): string {
  return process.env.JWT_EXPIRES_IN?.trim() || '1d';
}

/** Domínios autorizados a chamar a API pelo navegador (o app mobile não depende de CORS). */
export function corsOrigins(): string[] | true {
  const raw = process.env.CORS_ORIGINS?.trim();
  if (!raw) {
    if (isProduction()) throw new Error('Defina CORS_ORIGINS com o domínio do painel (ex.: https://checkon.vercel.app).');
    return true; // desenvolvimento: libera tudo
  }
  return raw.split(',').map((origin) => origin.trim().replace(/\/$/, '')).filter(Boolean);
}

export type StorageDriverName = 'local' | 's3';

export function storageDriver(): StorageDriverName {
  const driver = (process.env.STORAGE_DRIVER?.trim() || (isProduction() ? 's3' : 'local')) as StorageDriverName;
  if (driver !== 'local' && driver !== 's3') throw new Error('STORAGE_DRIVER deve ser "local" ou "s3".');
  return driver;
}

export function publicApiUrl(): string {
  return (process.env.PUBLIC_API_URL?.trim() || `http://localhost:${process.env.PORT || '3333'}`).replace(/\/$/, '');
}

export function s3Config() {
  return {
    endpoint: process.env.S3_ENDPOINT?.trim() || undefined,
    region: process.env.S3_REGION?.trim() || 'auto',
    bucket: required('S3_BUCKET'),
    accessKeyId: required('S3_ACCESS_KEY_ID'),
    secretAccessKey: required('S3_SECRET_ACCESS_KEY'),
    publicUrl: required('STORAGE_PUBLIC_URL').replace(/\/$/, ''),
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
  };
}

/** Confere tudo na inicialização, para a falha aparecer no deploy e não no primeiro acesso. */
export function validateEnvOnStartup() {
  jwtSecret();
  corsOrigins();
  if (isProduction()) required('DATABASE_URL');
  if (storageDriver() === 's3') s3Config();
}
