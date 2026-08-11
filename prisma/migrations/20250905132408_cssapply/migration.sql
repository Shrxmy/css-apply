-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "studentNumber" VARCHAR(10),
    "section" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MemberApplication" (
    "id" TEXT NOT NULL,
    "studentNumber" TEXT NOT NULL,
    "paymentProof" TEXT NOT NULL,
    "hasAccepted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemberApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."EAApplication" (
    "id" TEXT NOT NULL,
    "studentNumber" TEXT NOT NULL,
    "firstOptionEb" TEXT NOT NULL,
    "secondOptionEb" TEXT NOT NULL,
    "portfolioLink" TEXT NOT NULL,
    "cv" TEXT NOT NULL,
    "interviewSlotDay" TEXT NOT NULL,
    "interviewSlotTimeStart" TEXT NOT NULL,
    "interviewSlotTimeEnd" TEXT NOT NULL,
    "hasFinishedInterview" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT,
    "redirection" TEXT,
    "hasAccepted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EAApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CommitteeApplication" (
    "id" TEXT NOT NULL,
    "studentNumber" TEXT NOT NULL,
    "firstOptionCommittee" TEXT NOT NULL,
    "secondOptionCommittee" TEXT NOT NULL,
    "portfolioLink" TEXT NOT NULL,
    "cv" TEXT NOT NULL,
    "interviewSlotDay" TEXT NOT NULL,
    "interviewSlotTimeStart" TEXT NOT NULL,
    "interviewSlotTimeEnd" TEXT NOT NULL,
    "hasFinishedInterview" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT,
    "redirection" TEXT,
    "hasAccepted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommitteeApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AvailableEBInterviewTime" (
    "id" TEXT NOT NULL,
    "eb" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "timeStart" TEXT NOT NULL,
    "timeEnd" TEXT NOT NULL,
    "maxSlots" INTEGER NOT NULL,
    "currentSlots" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AvailableEBInterviewTime_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_studentNumber_key" ON "public"."User"("studentNumber");

-- CreateIndex
CREATE UNIQUE INDEX "MemberApplication_studentNumber_key" ON "public"."MemberApplication"("studentNumber");

-- CreateIndex
CREATE UNIQUE INDEX "EAApplication_studentNumber_key" ON "public"."EAApplication"("studentNumber");

-- CreateIndex
CREATE UNIQUE INDEX "CommitteeApplication_studentNumber_key" ON "public"."CommitteeApplication"("studentNumber");

-- AddForeignKey
ALTER TABLE "public"."MemberApplication" ADD CONSTRAINT "MemberApplication_studentNumber_fkey" FOREIGN KEY ("studentNumber") REFERENCES "public"."User"("studentNumber") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EAApplication" ADD CONSTRAINT "EAApplication_studentNumber_fkey" FOREIGN KEY ("studentNumber") REFERENCES "public"."User"("studentNumber") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CommitteeApplication" ADD CONSTRAINT "CommitteeApplication_studentNumber_fkey" FOREIGN KEY ("studentNumber") REFERENCES "public"."User"("studentNumber") ON DELETE CASCADE ON UPDATE CASCADE;
