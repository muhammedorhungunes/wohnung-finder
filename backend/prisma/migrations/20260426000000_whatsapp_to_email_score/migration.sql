-- Rename whatsapp_number to email in filters
ALTER TABLE "filters" RENAME COLUMN "whatsapp_number" TO "email";

-- Add score column to matches
ALTER TABLE "matches" ADD COLUMN "score" DOUBLE PRECISION;
