CREATE TYPE "ReservationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED', 'CANCELLED');

CREATE TABLE "Admin" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "phone" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Reservation" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "reservationDate" DATE NOT NULL,
  "reservationTime" TEXT NOT NULL,
  "area" TEXT,
  "partySize" INTEGER NOT NULL,
  "notes" TEXT,
  "status" "ReservationStatus" NOT NULL DEFAULT 'PENDING',
  "confirmedAt" TIMESTAMP(3),
  "confirmedById" TEXT,
  "rejectedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "emailError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Admin_email_key" ON "Admin"("email");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "Reservation_status_reservationDate_reservationTime_idx" ON "Reservation"("status", "reservationDate", "reservationTime");
CREATE INDEX "Reservation_area_idx" ON "Reservation"("area");

CREATE UNIQUE INDEX "Reservation_confirmed_slot_area_key"
  ON "Reservation"("reservationDate", "reservationTime", "area")
  WHERE "status" = 'CONFIRMED' AND "area" IS NOT NULL;

CREATE UNIQUE INDEX "Reservation_confirmed_slot_no_area_key"
  ON "Reservation"("reservationDate", "reservationTime")
  WHERE "status" = 'CONFIRMED' AND "area" IS NULL;

ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_confirmedById_fkey"
  FOREIGN KEY ("confirmedById") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
