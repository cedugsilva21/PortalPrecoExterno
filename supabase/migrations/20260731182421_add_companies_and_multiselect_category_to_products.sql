/*
# Products: add companies array and convert category to array

1. Changes
- `category` column: converted from single text to text[] so a product can belong
  to both Natural and Orgânica categories simultaneously.
  Existing rows have their current single value wrapped in an array automatically.
- `companies` column: new text[] column to record which companies sell this product
  (Usibras, Nutsco, Ghana). Existing rows default to an empty array.

2. Notes
- No data is lost. The USING clause migrates existing text values to single-element arrays.
- Both columns default to an empty array so future INSERTs that omit them don't fail.
*/

-- Step 1: add a new array column alongside the old one
ALTER TABLE products ADD COLUMN IF NOT EXISTS category_arr text[] NOT NULL DEFAULT '{}';

-- Step 2: migrate existing single values into the new array column
UPDATE products SET category_arr = ARRAY[category::text] WHERE category IS NOT NULL AND category::text <> '';

-- Step 3: drop the old column and rename
ALTER TABLE products DROP COLUMN category;
ALTER TABLE products RENAME COLUMN category_arr TO category;

-- Step 4: add companies column
ALTER TABLE products ADD COLUMN IF NOT EXISTS companies text[] NOT NULL DEFAULT '{}';
