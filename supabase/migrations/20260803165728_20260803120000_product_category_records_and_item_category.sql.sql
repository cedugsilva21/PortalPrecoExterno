/*
# Product × Category as independent records; category on price_table_items

## Summary
Changes the data model so that each combination of Product × Category is an
independent record, instead of storing multiple categories in a single text[]
column on the product. Price table items now carry their own `category` column
so each line in a price table is a self-contained Product × Category row with
its own prices and calculations.

## 1. New table: product_categories
- `id` (uuid, PK)
- `product_id` (uuid, FK → products, ON DELETE CASCADE)
- `category` (text, NOT NULL — 'Natural' or 'Orgânica')
- `created_at` (timestamptz)
- UNIQUE constraint on (product_id, category) so a product cannot have the same
  category twice.
- RLS enabled, authenticated CRUD (same posture as products).

## 2. products table
- `category` text[] column is KEPT for backward compatibility / display, but is
  now derived from product_categories. We do NOT drop it (data safety). A trigger
  keeps it in sync with product_categories so existing code that reads
  products.category continues to work.
- `companies` text[] unchanged.

## 3. price_table_items table
- New column `category` text (nullable) — stores the category of this specific
  Product × Category line. Each item row is now self-contained.
- Index on (price_table_id, product_id, category).

## 4. Data migration
- For every existing product, insert one row into product_categories for each
  element currently in products.category (deduplicated by the unique constraint).
- For existing price_table_items, backfill the new `category` column from the
  product's first category (best-effort, since old items had no per-line category).

## 5. Sync trigger
- AFTER INSERT/UPDATE/DELETE on product_categories → rebuild products.category
  as an array of the product's categories. This keeps the denormalized array in
  sync so existing UI code that reads product.category keeps working.

## 6. Security
- RLS enabled on product_categories with authenticated CRUD (matches products).
*/

-- 1. product_categories table
CREATE TABLE IF NOT EXISTS product_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('Natural', 'Orgânica')),
  created_at timestamptz DEFAULT now(),
  CONSTRAINT product_categories_product_category_key UNIQUE (product_id, category)
);

ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "product_categories_select_all" ON product_categories;
CREATE POLICY "product_categories_select_all" ON product_categories FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "product_categories_insert_all" ON product_categories;
CREATE POLICY "product_categories_insert_all" ON product_categories FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "product_categories_update_all" ON product_categories;
CREATE POLICY "product_categories_update_all" ON product_categories FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "product_categories_delete_all" ON product_categories;
CREATE POLICY "product_categories_delete_all" ON product_categories FOR DELETE
  TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_product_categories_product_id ON product_categories(product_id);

-- 2. Backfill product_categories from existing products.category array
INSERT INTO product_categories (product_id, category)
SELECT p.id, cat
FROM products p,
     unnest(p.category) AS cat
WHERE NOT EXISTS (
  SELECT 1 FROM product_categories pc WHERE pc.product_id = p.id AND pc.category = cat
)
ON CONFLICT (product_id, category) DO NOTHING;

-- 3. Add category column to price_table_items
ALTER TABLE price_table_items ADD COLUMN IF NOT EXISTS category text;
CREATE INDEX IF NOT EXISTS idx_items_table_product_category
  ON price_table_items(price_table_id, product_id, category);

-- 4. Backfill price_table_items.category from product's first category
UPDATE price_table_items iti
SET category = sub.cat
FROM (
  SELECT p.id AS product_id, COALESCE(p.category[1], 'Natural') AS cat
  FROM products p
) sub
WHERE iti.product_id = sub.product_id
  AND iti.category IS NULL;

-- 5. Sync trigger: keep products.category in sync with product_categories
CREATE OR REPLACE FUNCTION sync_product_category_array()
RETURNS TRIGGER AS $$
DECLARE
  pid uuid;
BEGIN
  pid := COALESCE(NEW.product_id, OLD.product_id);
  IF pid IS NOT NULL THEN
    UPDATE products
    SET category = COALESCE((
      SELECT array_agg(pc.category ORDER BY pc.category)
      FROM product_categories pc
      WHERE pc.product_id = pid
    ), ARRAY[]::text[])
    WHERE id = pid;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS product_categories_sync ON product_categories;
CREATE TRIGGER product_categories_sync
  AFTER INSERT OR UPDATE OR DELETE ON product_categories
  FOR EACH ROW EXECUTE FUNCTION sync_product_category_array();
