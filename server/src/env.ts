import dotenv from 'dotenv';
dotenv.config();

export const env = {
  port: parseInt(process.env.PORT || '4000', 10),
  databaseUrl: process.env.DATABASE_URL || 'postgresql://kaissa:kaissa@localhost:5432/kaissa?schema=public',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret',
  abandonSeconds: parseInt(process.env.ABANDON_SECONDS || '20', 10),
  corsOrigin: process.env.CORS_ORIGIN || '*',
  /** Кому автоматически выдать права администратора (через запятую) */
  adminUsernames: (process.env.ADMIN_USERNAMES || '').split(',').map((s) => s.trim()).filter(Boolean),
};
