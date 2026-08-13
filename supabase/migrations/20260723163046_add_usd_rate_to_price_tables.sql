-- Add USD exchange rate to price tables for BRL/USD conversion
ALTER TABLE price_tables ADD COLUMN IF NOT EXISTS usd_rate numeric(10,4) DEFAULT 5.0000;

-- Add cost_source to price_table_items to track Protheus integration
ALTER TABLE price_table_items ADD COLUMN IF NOT EXISTS cost_source text DEFAULT 'protheus';

COMMENT ON COLUMN price_tables.usd_rate IS 'Taxa de câmbio USD->BRL aplicada para cálculo de desvio';
COMMENT ON COLUMN price_table_items.cost_source IS 'Origem do custo: protheus (integracao) ou manual';
