import dotenv from 'dotenv';
dotenv.config();

if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'dev-secret' || process.env.JWT_SECRET.length < 32)) {
  throw new Error('JWT_SECRET must be set and at least 32 characters in production');
}

export const env = {
  port: parseInt(process.env.PORT || '4000', 10),
  databaseUrl: process.env.DATABASE_URL || 'postgresql://kaissa:kaissa@localhost:5432/kaissa?schema=public',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret',
  abandonSeconds: parseInt(process.env.ABANDON_SECONDS || '20', 10),
  corsOrigin: process.env.CORS_ORIGIN || '*',
  /** Кому автоматически выдать права администратора (через запятую) */
  adminUsernames: (process.env.ADMIN_USERNAMES || '').split(',').map((s) => s.trim()).filter(Boolean),
};
