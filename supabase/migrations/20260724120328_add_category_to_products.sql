-- Add category column to products (Natural or Orgânica)
ALTER TABLE products ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'Natural';

-- Add constraint to ensure only valid values
DO $$ BEGIN
  ALTER TABLE products ADD CONSTRAINT products_category_check CHECK (category IN ('Natural', 'Orgânica'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Backfill existing rows (already default 'Natural' but ensure)
UPDATE products SET category = 'Natural' WHERE category IS NULL;
