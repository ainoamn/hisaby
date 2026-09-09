-- BHD-R inbound integration: token on company + idempotent event log

ALTER TABLE "companies"
  ADD COLUMN IF NOT EXISTS "bhd_r_inbound_token_hash" TEXT,
  ADD COLUMN IF NOT EXISTS "bhd_r_inbound_token_prefix" TEXT,
  ADD COLUMN IF NOT EXISTS "bhd_r_inbound_created_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "bhd_r_inbound_created_by_id" TEXT,
  ADD COLUMN IF NOT EXISTS "bhd_r_inbound_last_used_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "bhd_r_read_api_key_enc" TEXT,
  ADD COLUMN IF NOT EXISTS "bhd_r_organization_external_id" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "companies_bhd_r_inbound_token_hash_key"
  ON "companies"("bhd_r_inbound_token_hash");

CREATE TABLE IF NOT EXISTS "bhd_r_inbound_events" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'processing',
  "invoice_id" TEXT,
  "payment_id" TEXT,
  "error_message" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "bhd_r_inbound_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "bhd_r_inbound_events_company_id_idempotency_key_key"
  ON "bhd_r_inbound_events"("company_id", "idempotency_key");

CREATE INDEX IF NOT EXISTS "bhd_r_inbound_events_company_id_created_at_idx"
  ON "bhd_r_inbound_events"("company_id", "created_at");

ALTER TABLE "bhd_r_inbound_events"
  DROP CONSTRAINT IF EXISTS "bhd_r_inbound_events_company_id_fkey";

ALTER TABLE "bhd_r_inbound_events"
  ADD CONSTRAINT "bhd_r_inbound_events_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
