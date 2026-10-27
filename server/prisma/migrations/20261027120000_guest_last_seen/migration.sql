ALTER TABLE "User" ADD COLUMN "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE INDEX "User_isGuest_lastSeenAt_idx" ON "User"("isGuest", "lastSeenAt");
