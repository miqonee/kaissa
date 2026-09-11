// scripts/reset-bot-stats.mjs
// Скрипт сброса всех партий, ходов и статистики ботов
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env') });
dotenv.config({ path: resolve(process.cwd(), 'server/.env') });

let dbUrl = process.env.DATABASE_URL;
if (!dbUrl || dbUrl.includes('@db:5432')) {
  // Если скрипт запущен снаружи Docker на машине разработчика
  dbUrl = (dbUrl || 'postgresql://kaissa:kaissa-secret-change-me@localhost:5432/kaissa?schema=public').replace('@db:5432', '@localhost:5432');
}

const prisma = new PrismaClient({
  datasources: { db: { url: dbUrl } },
});

const BOT_NOMINALS = {
  bot_morphy: { elo: 750, level: 2 },
  bot_spassky: { elo: 1000, level: 3 },
  bot_capablanca: { elo: 1200, level: 4 },
  bot_petrosian: { elo: 1300, level: 5 },
  bot_botvinnik: { elo: 1400, level: 5 },
  bot_karpov: { elo: 1450, level: 6 },
  bot_aljechin: { elo: 1500, level: 6 },
  bot_tal: { elo: 1550, level: 6 },
  bot_nakamura: { elo: 1580, level: 7 },
  bot_kasparov: { elo: 1600, level: 7 },
  bot_fischer: { elo: 1650, level: 7 },
  bot_carlsen: { elo: 1750, level: 8 },
};

async function main() {
  console.log('🔄 Сброс базы данных: партии, статистика и рейтинг ботов...');

  // 1. Очистка таблиц партий и истории
  const delMoves = await prisma.gameMove.deleteMany({});
  console.log(`- Удалено ходов: ${delMoves.count}`);

  const delParticipants = await prisma.gameParticipant.deleteMany({});
  console.log(`- Удалено участников партий: ${delParticipants.count}`);

  const delHistory = await prisma.ratingHistory.deleteMany({});
  console.log(`- Удалено записей истории рейтинга: ${delHistory.count}`);

  const delGames = await prisma.game.deleteMany({});
  console.log(`- Удалено партий: ${delGames.count}`);

  // 2. Сброс статистики ботов
  const botUsers = await prisma.user.findMany({ where: { isBot: true } });
  for (const bot of botUsers) {
    const preset = BOT_NOMINALS[bot.username];
    await prisma.user.update({
      where: { id: bot.id },
      data: {
        wins: 0,
        losses: 0,
        draws: 0,
        rating: preset?.elo ?? 1200,
        botLevel: preset?.level ?? 4,
      },
    });
    console.log(`- Сброшен бот: ${bot.username} (Elo: ${preset?.elo ?? 1200}, Ур: ${preset?.level ?? 4})`);
  }

  // 3. Сброс счетчиков побед/поражений обычных пользователей (если они играли только в тестовые партии)
  const resetHumans = await prisma.user.updateMany({
    where: { isBot: false },
    data: {
      wins: 0,
      losses: 0,
      draws: 0,
      rating: 1200,
    },
  });
  console.log(`- Сброшена статистика пользователей: ${resetHumans.count}`);

  console.log('✅ База данных и статистика ботов успешно очищены!');
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('❌ Ошибка при сбросе статистики:', err);
  prisma.$disconnect();
  process.exit(1);
});
