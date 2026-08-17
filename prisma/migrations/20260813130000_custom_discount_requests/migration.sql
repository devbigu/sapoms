DO $$
BEGIN
  CREATE TYPE "DiscountRequestScope" AS ENUM ('ORDER', 'PRODUCT');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "DiscountRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "custom_discount_requests" (
  "id" BIGSERIAL NOT NULL,
  "dealer_id" BIGINT NOT NULL,
  "staff_id" BIGINT,
  "order_id" BIGINT,
  "order_draft_id" BIGINT,
  "scope" "DiscountRequestScope" NOT NULL,
  "status" "DiscountRequestStatus" NOT NULL DEFAULT 'PENDING',
  "requested_discount_percent" DECIMAL(7,4) NOT NULL DEFAULT 0,
  "current_discount_percent" DECIMAL(7,4) NOT NULL DEFAULT 0,
  "requested_order_discount_percent" DECIMAL(7,4),
  "requested_product_discounts" JSONB,
  "target_product_key" TEXT,
  "gross_amount_paise" BIGINT,
  "requested_discount_amount_paise" BIGINT,
  "requested_net_payable_amount_paise" BIGINT,
  "order_signature" TEXT,
  "order_snapshot" JSONB,
  "admin_note" TEXT,
  "allow_reorder" BOOLEAN NOT NULL DEFAULT false,
  "reviewed_by_user_id" BIGINT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewed_at" TIMESTAMPTZ(6),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "custom_discount_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "custom_discount_reorder_logs" (
  "id" BIGSERIAL NOT NULL,
  "request_id" BIGINT NOT NULL,
  "order_id" BIGINT NOT NULL,
  "dealer_id" BIGINT NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "custom_discount_reorder_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "custom_discount_requests_dealer_id_status_idx" ON "custom_discount_requests"("dealer_id", "status");
CREATE INDEX IF NOT EXISTS "custom_discount_requests_order_id_idx" ON "custom_discount_requests"("order_id");
CREATE INDEX IF NOT EXISTS "custom_discount_requests_order_draft_id_idx" ON "custom_discount_requests"("order_draft_id");
CREATE INDEX IF NOT EXISTS "custom_discount_requests_status_created_at_idx" ON "custom_discount_requests"("status", "created_at");
CREATE INDEX IF NOT EXISTS "custom_discount_reorder_logs_request_id_idx" ON "custom_discount_reorder_logs"("request_id");
CREATE INDEX IF NOT EXISTS "custom_discount_reorder_logs_order_id_idx" ON "custom_discount_reorder_logs"("order_id");

ALTER TABLE "custom_discount_requests"
  ADD CONSTRAINT "custom_discount_requests_dealer_id_fkey"
  FOREIGN KEY ("dealer_id") REFERENCES "dealer_profiles"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "custom_discount_requests"
  ADD CONSTRAINT "custom_discount_requests_staff_id_fkey"
  FOREIGN KEY ("staff_id") REFERENCES "staff_profiles"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "custom_discount_requests"
  ADD CONSTRAINT "custom_discount_requests_order_id_fkey"
  FOREIGN KEY ("order_id") REFERENCES "orders"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "custom_discount_requests"
  ADD CONSTRAINT "custom_discount_requests_order_draft_id_fkey"
  FOREIGN KEY ("order_draft_id") REFERENCES "order_drafts"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "custom_discount_requests"
  ADD CONSTRAINT "custom_discount_requests_reviewed_by_user_id_fkey"
  FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "custom_discount_reorder_logs"
  ADD CONSTRAINT "custom_discount_reorder_logs_request_id_fkey"
  FOREIGN KEY ("request_id") REFERENCES "custom_discount_requests"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "custom_discount_reorder_logs"
  ADD CONSTRAINT "custom_discount_reorder_logs_order_id_fkey"
  FOREIGN KEY ("order_id") REFERENCES "orders"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;