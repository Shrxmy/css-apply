CREATE TABLE "CommunityJoinConfirmation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "recruitmentCycleId" TEXT NOT NULL,
    "paymentRequirementAcknowledgedAt" TIMESTAMP(3),
    "hasJoined" BOOLEAN,
    "respondedAt" TIMESTAMP(3),
    "lastReminderSentAt" TIMESTAMP(3),
    "reminderCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunityJoinConfirmation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CommunityJoinConfirmation_userId_recruitmentCycleId_key"
    ON "CommunityJoinConfirmation"("userId", "recruitmentCycleId");
CREATE INDEX "CommunityJoinConfirmation_recruitmentCycleId_hasJoined_idx"
    ON "CommunityJoinConfirmation"("recruitmentCycleId", "hasJoined");
CREATE INDEX "CommunityJoinConfirmation_recruitmentCycleId_lastReminderSentAt_idx"
    ON "CommunityJoinConfirmation"("recruitmentCycleId", "lastReminderSentAt");

ALTER TABLE "CommunityJoinConfirmation"
    ADD CONSTRAINT "CommunityJoinConfirmation_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunityJoinConfirmation"
    ADD CONSTRAINT "CommunityJoinConfirmation_recruitmentCycleId_fkey"
    FOREIGN KEY ("recruitmentCycleId") REFERENCES "RecruitmentCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
