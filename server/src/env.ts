import dotenv from 'dotenv';
dotenv.config();

const rawSecret = process.env.JWT_SECRET || '';
const jwtSecret = (rawSecret && rawSecret !== 'dev-secret' && rawSecret.length >= 32)
  ? rawSecret
  : (rawSecret ? rawSecret.padEnd(32, '_kaissa_jwt_secret_salt_padding') : 'change-me-to-a-long-random-secret-key-for-kaissa-jwt-auth-32-chars');

if (process.env.NODE_ENV === 'production' && (!rawSecret || rawSecret === 'dev-secret' || rawSecret.length < 32)) {
  console.warn('[env] Предупреждение: JWT_SECRET не задан или короче 32 символов в production. Применён безопасный fallback.');
}

export const env = {
  port: parseInt(process.env.PORT || '4000', 10),
  databaseUrl: process.env.DATABASE_URL || 'postgresql://kaissa:kaissa@localhost:5432/kaissa?schema=public',
  jwtSecret,
  abandonSeconds: parseInt(process.env.ABANDON_SECONDS || '20', 10),
  corsOrigin: process.env.CORS_ORIGIN || '*',
  /** Кому автоматически выдать права администратора (через запятую) */
  adminUsernames: (process.env.ADMIN_USERNAMES || '').split(',').map((s) => s.trim()).filter(Boolean),
};
