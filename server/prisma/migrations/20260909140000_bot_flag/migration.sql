-- Флаг бота и уровень сложности
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isBot" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "botLevel" INTEGER;
CREATE INDEX IF NOT EXISTS "User_isBot_idx" ON "User"("isBot");
