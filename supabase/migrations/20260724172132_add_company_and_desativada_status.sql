-- Add company column to price_tables
ALTER TABLE price_tables ADD COLUMN IF NOT EXISTS company text NOT NULL DEFAULT 'Brasil';

DO $$ BEGIN
  ALTER TABLE price_tables ADD CONSTRAINT price_tables_company_check
    CHECK (company IN ('Brasil', 'Ghana', 'Nutsco'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add status for 'desativada'
ALTER TABLE price_tables DROP CONSTRAINT IF EXISTS price_tables_status_check;
ALTER TABLE price_tables ADD CONSTRAINT price_tables_status_check
  CHECK (status IN ('rascunho', 'pendente', 'publicada', 'expirada', 'rejeitada', 'desativada'));
