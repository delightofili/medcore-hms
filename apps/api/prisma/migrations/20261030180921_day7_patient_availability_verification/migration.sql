-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedById" UUID,
ADD COLUMN     "emailVerificationRequired" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "EmailVerification" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastSentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DoctorUnavailablePeriod" (
    "id" UUID NOT NULL,
    "doctorId" UUID NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DoctorUnavailablePeriod_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailVerification_userId_expiresAt_idx" ON "EmailVerification"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "DoctorUnavailablePeriod_doctorId_startsAt_endsAt_idx" ON "DoctorUnavailablePeriod"("doctorId", "startsAt", "endsAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailVerification" ADD CONSTRAINT "EmailVerification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorUnavailablePeriod" ADD CONSTRAINT "DoctorUnavailablePeriod_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
