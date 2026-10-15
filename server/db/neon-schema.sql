-- Ayngaran Futura - PostgreSQL schema for Neon (PostgREST / REST API).
--
-- Run once against your Neon database, e.g.:
--   psql "$DATABASE_URL" -f server/db/neon-schema.sql
-- or paste it into the Neon console SQL editor.
--
-- Column names are quoted camelCase so they match TABLE_COLUMNS in
-- schema.js exactly - the frontend and the API need no changes.
--
-- `seq` gives every table a reliable insertion order. PostgREST cannot sort
-- by rowid the way SQLite does, and `id` ordering breaks once ids outgrow
-- four digits (MKT-10000 sorts before MKT-9999 as text).

BEGIN;

CREATE TABLE IF NOT EXISTS marketers (
  seq                bigserial PRIMARY KEY,
  id                 text UNIQUE NOT NULL,
  name               text,
  phone              text,
  email              text,
  region             text,
  "commissionPercent" double precision,
  status             text,
  "joinedOn"         text,
  remarks            text,
  "createdAt"        timestamptz,
  "updatedAt"        timestamptz
);

CREATE TABLE IF NOT EXISTS projects (
  seq                bigserial PRIMARY KEY,
  id                 text UNIQUE NOT NULL,
  name               text,
  "siteName"         text,
  location           text,
  "surveyNumber"     text,
  "pattaNumber"      text,
  "approvalNo"       text,
  "totalAreaAcres"   double precision,
  "totalAreaSqft"    double precision,
  "totalPlots"       double precision,
  "pricePerSqft"     double precision,
  "launchDate"       text,
  "landOwner"        text,
  status             text,
  remarks            text,
  "createdAt"        timestamptz,
  "updatedAt"        timestamptz
);

CREATE TABLE IF NOT EXISTS bookings (
  seq                bigserial PRIMARY KEY,
  id                 text UNIQUE NOT NULL,
  "customerName"     text,
  phone              text,
  "projectRef"       text,
  "plotNumber"       text,
  "areaCents"        double precision,
  "squareFeet"       double precision,
  "totalAmount"      double precision,
  "bookingAmount"    double precision,
  "bookingDate"      text,
  "marketerRef"      text,
  status             text,
  remarks            text,
  "createdAt"        timestamptz,
  "updatedAt"        timestamptz
);

CREATE TABLE IF NOT EXISTS loans (
  seq                bigserial PRIMARY KEY,
  id                 text UNIQUE NOT NULL,
  "lenderName"       text,
  "liabilityType"    text,
  "projectRef"       text,
  "principalAmount"  double precision,
  "outstandingBalance" double precision,
  "interestRate"     double precision,
  "emiAmount"        double precision,
  "emiDay"           text,
  "tenureMonths"     double precision,
  "sanctionDate"     text,
  "documentRef"      text,
  status             text,
  remarks            text,
  "createdAt"        timestamptz,
  "updatedAt"        timestamptz
);

CREATE TABLE IF NOT EXISTS vouchers (
  seq                bigserial PRIMARY KEY,
  id                 text UNIQUE NOT NULL,
  type               text,
  date               text,
  category           text,
  amount             double precision,
  "paymentMode"      text,
  "paidTo"           text,
  "projectRef"       text,
  remarks            text,
  "createdAt"        timestamptz,
  "updatedAt"        timestamptz
);

CREATE TABLE IF NOT EXISTS settings (
  key                text PRIMARY KEY,
  value              text
);

-- Free-text references rather than foreign keys (the UI allows "not linked"),
-- but this index keeps the referential check on delete fast.
CREATE INDEX IF NOT EXISTS bookings_projectref_idx  ON bookings  ("projectRef");
CREATE INDEX IF NOT EXISTS loans_projectref_idx     ON loans     ("projectRef");
CREATE INDEX IF NOT EXISTS vouchers_projectref_idx  ON vouchers  ("projectRef");
CREATE INDEX IF NOT EXISTS bookings_marketerref_idx ON bookings  ("marketerRef");

-- PostgREST needs to be able to see the schema or it caches nothing correctly.
NOTIFY pgrst, 'reload schema';

COMMIT;