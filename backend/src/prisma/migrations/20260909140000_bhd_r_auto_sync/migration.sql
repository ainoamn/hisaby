ALTER TABLE "companies"
  ADD COLUMN IF NOT EXISTS "bhd_r_last_sync_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "bhd_r_last_sync_error" TEXT,
  ADD COLUMN IF NOT EXISTS "bhd_r_last_sync_summary" JSONB;
