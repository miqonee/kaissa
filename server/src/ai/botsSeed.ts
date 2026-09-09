import bcrypt from 'bcryptjs';
import { BOT_PRESETS } from 'shared';
import { prisma } from '../prisma.js';

export async function seedBots(): Promise<void> {
  const dummyHash = await bcrypt.hash('system_bot_unusable_pw_!#42', 10);

  for (const preset of BOT_PRESETS) {
    const existing = await prisma.user.findUnique({ where: { username: preset.username } });
    if (!existing) {
      await prisma.user.create({
        data: {
          username: preset.username,
          passwordHash: dummyHash,
          rating: preset.elo,
          isBot: true,
          botLevel: preset.level,
        },
      });
      console.log(`[ai] Создан бот: ${preset.name} (${preset.username}, Elo ${preset.elo})`);
    } else {
      // Обновляем параметры, если изменились
      if (!existing.isBot || existing.botLevel !== preset.level || existing.rating !== preset.elo) {
        await prisma.user.update({
          where: { id: existing.id },
          data: {
            isBot: true,
            botLevel: preset.level,
            rating: preset.elo,
          },
        });
      }
    }
  }
}
