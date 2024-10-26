-- CreateTable
CREATE TABLE "Patient" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "age" TEXT NOT NULL,
    "caretakerName" TEXT NOT NULL,
    "caretakerPhoneNumber" TEXT NOT NULL,
    "medicalHistory" TEXT,
    "address" TEXT NOT NULL,
    "incidentLocation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Patient_pkey" PRIMARY KEY ("id")
);
