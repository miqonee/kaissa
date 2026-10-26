import dotenv from 'dotenv';
import { randomBytes } from 'node:crypto';
dotenv.config();

const rawSecret = process.env.JWT_SECRET || '';
const validSecret = rawSecret.length >= 32 && !/^(change-me|dev-secret|replace-with)/i.test(rawSecret);
if (process.env.NODE_ENV === 'production' && !validSecret) throw new Error('JWT_SECRET must be a private random secret of at least 32 characters');
const jwtSecret = validSecret ? rawSecret : randomBytes(48).toString('hex');

export const env = {
  demoEnabled: process.env.DEMO_ENABLED === 'true' || (process.env.DEMO_ENABLED !== 'false' && process.env.NODE_ENV !== 'test'),
  port: parseInt(process.env.PORT || '4000', 10),
  databaseUrl: process.env.DATABASE_URL || 'postgresql://kaissa:kaissa@localhost:5432/kaissa?schema=public',
  jwtSecret,
  abandonSeconds: parseInt(process.env.ABANDON_SECONDS || '20', 10),
  corsOrigin: process.env.CORS_ORIGIN || '*',
  /** Кому автоматически выдать права администратора (через запятую) */
  adminUserIds: (process.env.ADMIN_USER_IDS || '').split(',').map(Number).filter(n => Number.isSafeInteger(n) && n > 0),
  /** Время жизни нестартовавшего стола (в минутах) до автоматического закрытия */
  lobbyTtlMinutes: parseInt(process.env.LOBBY_TTL_MINUTES || '20', 10),
  /** За сколько минут до закрытия стола отправлять предупреждение в лобби */
  lobbyWarnMinutes: parseInt(process.env.LOBBY_WARN_MINUTES || '2', 10),
  /** Публичный URL сайта для sitemap и поисковых ботов */
  siteUrl: (process.env.SITE_URL || 'https://duochess.ru').replace(/\/+$/, ''),
  /** Основной хост для robots.txt */
  siteHost: process.env.SITE_HOST || 'duochess.ru',
};
