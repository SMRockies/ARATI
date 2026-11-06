CREATE TABLE "proof_attachments" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "postingId" UUID NOT NULL,
    "storageKey" VARCHAR(100) NOT NULL,
    "fileName" VARCHAR(255) NOT NULL,
    "mimeType" VARCHAR(100) NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "sha256" CHAR(64) NOT NULL,
    "uploadedByUserId" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "proof_attachments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "proof_attachments_file_size_check" CHECK ("fileSizeBytes" > 0 AND "fileSizeBytes" <= 10485760),
    CONSTRAINT "proof_attachments_mime_type_check" CHECK ("mimeType" IN ('image/jpeg', 'image/png', 'application/pdf'))
);

CREATE UNIQUE INDEX "proof_attachments_postingId_key" ON "proof_attachments"("postingId");
CREATE UNIQUE INDEX "proof_attachments_storageKey_key" ON "proof_attachments"("storageKey");
CREATE INDEX "proof_attachments_organizationId_createdAt_idx" ON "proof_attachments"("organizationId", "createdAt");

ALTER TABLE "proof_attachments"
    ADD CONSTRAINT "proof_attachments_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "proof_attachments"
    ADD CONSTRAINT "proof_attachments_postingId_fkey"
    FOREIGN KEY ("postingId") REFERENCES "inventory_postings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "proof_attachments"
    ADD CONSTRAINT "proof_attachments_uploadedByUserId_fkey"
    FOREIGN KEY ("uploadedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION arati_validate_receipt_proof() RETURNS trigger AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM "inventory_postings"
         WHERE "id" = NEW."postingId"
           AND "organizationId" = NEW."organizationId"
           AND "type" = 'RECEIPT'
    ) THEN
        RAISE EXCEPTION 'proof attachments may only be linked to a receipt posting in the same organization'
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "proof_attachments_receipt_only"
    BEFORE INSERT ON "proof_attachments"
    FOR EACH ROW EXECUTE FUNCTION arati_validate_receipt_proof();

-- PostgreSQL CHECK constraints cannot inspect another table. This trigger
-- enforces proof presence at the point each RECEIPT movement enters the ledger.
CREATE OR REPLACE FUNCTION arati_require_receipt_proof() RETURNS trigger AS $$
BEGIN
    IF NEW."type" = 'RECEIPT' AND NOT EXISTS (
        SELECT 1
          FROM "proof_attachments"
         WHERE "postingId" = NEW."postingId"
           AND "organizationId" = NEW."organizationId"
    ) THEN
        RAISE EXCEPTION 'receipt inventory movements require a proof attachment'
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "inventory_movements_receipt_proof_required"
    BEFORE INSERT ON "inventory_movements"
    FOR EACH ROW EXECUTE FUNCTION arati_require_receipt_proof();

CREATE OR REPLACE FUNCTION arati_reject_proof_attachment_mutation() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'proof attachments are immutable: % is not allowed', TG_OP
        USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "proof_attachments_append_only"
    BEFORE UPDATE OR DELETE ON "proof_attachments"
    FOR EACH ROW EXECUTE FUNCTION arati_reject_proof_attachment_mutation();
