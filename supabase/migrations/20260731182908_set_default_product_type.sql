/*
# Set default value for product_type column

product_type is a legacy column no longer shown in the product form.
Adding a default of 'N/A' prevents the NOT NULL constraint from
blocking new product creation.
*/

ALTER TABLE products ALTER COLUMN product_type SET DEFAULT 'N/A';
