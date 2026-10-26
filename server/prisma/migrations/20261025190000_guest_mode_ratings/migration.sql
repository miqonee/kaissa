ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;
ALTER TABLE "User" ADD COLUMN "isGuest" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "RatingHistory" ADD COLUMN "mode" TEXT;
ALTER TABLE "Game" ADD COLUMN "ratingKind" TEXT, ADD COLUMN "endBoardIndex" INTEGER;
ALTER TABLE "GameParticipant" ADD COLUMN "wasGuest" BOOLEAN NOT NULL DEFAULT false;
CREATE TABLE "ModeRating" (
  "userId" INTEGER NOT NULL, "mode" TEXT NOT NULL,
  "rating" INTEGER NOT NULL DEFAULT 1200,
  "wins" INTEGER NOT NULL DEFAULT 0, "losses" INTEGER NOT NULL DEFAULT 0, "draws" INTEGER NOT NULL DEFAULT 0,
  "trainingWins" INTEGER NOT NULL DEFAULT 0, "trainingLosses" INTEGER NOT NULL DEFAULT 0, "trainingDraws" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "ModeRating_pkey" PRIMARY KEY ("userId", "mode"),
  CONSTRAINT "ModeRating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ModeRating_mode_rating_idx" ON "ModeRating"("mode", "rating");
-- Historical common ratings and games remain intact. Independent ratings start at 1200.
