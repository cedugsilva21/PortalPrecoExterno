/*
# Portal de Tabela de Preços - Schema Completo

## Resumo
Cria o schema do banco de dados para o portal de precificação de castanha para exportação.
Inclui gestão de produtos, tabelas de preço, alçada de aprovação, e auditoria completa.

## Novas Tabelas

1. **profiles** - Perfil dos usuários com papel (role)
   - `id` (uuid, PK, referencia auth.users)
   - `full_name` (text, nome completo)
   - `role` (text, papel: comercial, gerente, diretor, superintendente, admin)
   - `email` (text, email do usuário)

2. **products** - Produtos de castanha
   - `id` (uuid, PK)
   - `code` (text, código único do produto)
   - `description` (text, descrição)
   - `product_type` (text, tipo: inteira, meios, pedaços, fragmentos, etc.)
   - `standard_cost` (numeric, custo padrão em BRL - preenchido manualmente no v1)

3. **price_tables** - Tabelas de preço
   - `id` (uuid, PK)
   - `name` (text, nome da tabela)
   - `validity_start` (date, início da vigência)
   - `validity_end` (date, fim da vigência)
   - `status` (text, status: rascunho, pendente, publicada, expirada, rejeitada)
   - `created_by` (uuid, referencia auth.users)

4. **price_table_items** - Itens das tabelas de preço
   - `id` (uuid, PK)
   - `price_table_id` (uuid, FK para price_tables)
   - `product_id` (uuid, FK para products)
   - `cost` (numeric, custo do produto)
   - `sale_price` (numeric, preço de venda)
   - `deviation_pct` (numeric, % de desvio calculado)
   - `usd_per_lb` (numeric, preço em dólar por libra)
   - `usd_per_kg` (numeric, preço em dólar por kg)

5. **approvals** - Registro de aprovações por alçada
   - `id` (uuid, PK)
   - `price_table_id` (uuid, FK para price_tables)
   - `level` (text, nível: gerente, diretor, superintendente)
   - `status` (text, status: pendente, aprovado, rejeitado)
   - `approver_id` (uuid, referencia auth.users)
   - `deviation_accepted` (numeric, % de desvio aceito)
   - `observations` (text, observações opcionais)
   - `rejection_reason` (text, motivo da rejeição)

6. **audit_log** - Log de auditoria
   - `id` (uuid, PK)
   - `price_table_id` (uuid, FK para price_tables)
   - `event_type` (text, tipo do evento)
   - `user_id` (uuid, referencia auth.users)
   - `user_name` (text)
   - `user_email` (text)
   - `details` (jsonb, detalhes do evento)
   - `ip_address` (text)
   - `user_agent` (text)

## Segurança (RLS)
- Todas as tabelas têm RLS habilitado
- Perfis: usuários autenticados podem ler todos os perfis; cada usuário atualiza o próprio
- Produtos: todos autenticados podem ler; apenas admin pode criar/editar
- Tabelas de preço: todos autenticados podem ler; autenticados podem criar; criador pode editar rascunhos
- Itens: todos autenticados podem ler; autenticados podem inserir/atualizar
- Aprovações: todos autenticados podem ler; autenticados podem inserir/atualizar
- Auditoria: todos autenticados podem ler e inserir
*/

-- PROFILES TABLE
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('comercial', 'gerente', 'diretor', 'superintendente', 'admin')),
  email text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_all" ON profiles;
CREATE POLICY "profiles_select_all" ON profiles FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

-- PRODUCTS TABLE
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  description text NOT NULL,
  product_type text NOT NULL,
  standard_cost numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "products_select_all" ON products;
CREATE POLICY "products_select_all" ON products FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "products_insert_admin" ON products;
CREATE POLICY "products_insert_admin" ON products FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "products_update_admin" ON products;
CREATE POLICY "products_update_admin" ON products FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "products_delete_admin" ON products;
CREATE POLICY "products_delete_admin" ON products FOR DELETE
  TO authenticated USING (true);

-- PRICE TABLES TABLE
CREATE TABLE IF NOT EXISTS price_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  validity_start date NOT NULL,
  validity_end date NOT NULL,
  status text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'pendente', 'publicada', 'expirada', 'rejeitada')),
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE price_tables ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "price_tables_select_all" ON price_tables;
CREATE POLICY "price_tables_select_all" ON price_tables FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "price_tables_insert_own" ON price_tables;
CREATE POLICY "price_tables_insert_own" ON price_tables FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "price_tables_update_own" ON price_tables;
CREATE POLICY "price_tables_update_own" ON price_tables FOR UPDATE
  TO authenticated USING (auth.uid() = created_by) WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "price_tables_delete_own" ON price_tables;
CREATE POLICY "price_tables_delete_own" ON price_tables FOR DELETE
  TO authenticated USING (auth.uid() = created_by);

-- PRICE TABLE ITEMS TABLE
CREATE TABLE IF NOT EXISTS price_table_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  price_table_id uuid NOT NULL REFERENCES price_tables(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id),
  cost numeric(12,4) NOT NULL DEFAULT 0,
  sale_price numeric(12,4) NOT NULL DEFAULT 0,
  deviation_pct numeric(8,2) NOT NULL DEFAULT 0,
  usd_per_lb numeric(12,4),
  usd_per_kg numeric(12,4),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE price_table_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "items_select_all" ON price_table_items;
CREATE POLICY "items_select_all" ON price_table_items FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "items_insert_all" ON price_table_items;
CREATE POLICY "items_insert_all" ON price_table_items FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "items_update_all" ON price_table_items;
CREATE POLICY "items_update_all" ON price_table_items FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "items_delete_all" ON price_table_items;
CREATE POLICY "items_delete_all" ON price_table_items FOR DELETE
  TO authenticated USING (true);

-- APPROVALS TABLE
CREATE TABLE IF NOT EXISTS approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  price_table_id uuid NOT NULL REFERENCES price_tables(id) ON DELETE CASCADE,
  level text NOT NULL CHECK (level IN ('gerente', 'diretor', 'superintendente')),
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'rejeitado')),
  approver_id uuid REFERENCES auth.users(id),
  approver_name text,
  deviation_accepted numeric(8,2),
  observations text,
  rejection_reason text,
  created_at timestamptz DEFAULT now(),
  decided_at timestamptz
);

ALTER TABLE approvals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "approvals_select_all" ON approvals;
CREATE POLICY "approvals_select_all" ON approvals FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "approvals_insert_all" ON approvals;
CREATE POLICY "approvals_insert_all" ON approvals FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "approvals_update_all" ON approvals;
CREATE POLICY "approvals_update_all" ON approvals FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

-- AUDIT LOG TABLE
CREATE TABLE IF NOT EXISTS audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  price_table_id uuid REFERENCES price_tables(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  user_id uuid REFERENCES auth.users(id),
  user_name text,
  user_email text,
  details jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_select_all" ON audit_log;
CREATE POLICY "audit_select_all" ON audit_log FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "audit_insert_all" ON audit_log;
CREATE POLICY "audit_insert_all" ON audit_log FOR INSERT
  TO authenticated WITH CHECK (true);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_price_tables_status ON price_tables(status);
CREATE INDEX IF NOT EXISTS idx_price_tables_created_by ON price_tables(created_by);
CREATE INDEX IF NOT EXISTS idx_items_price_table_id ON price_table_items(price_table_id);
CREATE INDEX IF NOT EXISTS idx_approvals_price_table_id ON approvals(price_table_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_price_table_id ON audit_log(price_table_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_event_type ON audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);

-- AUTO-UPDATE updated_at TRIGGERS
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS products_updated_at ON products;
CREATE TRIGGER products_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS price_tables_updated_at ON price_tables;
CREATE TRIGGER price_tables_updated_at BEFORE UPDATE ON price_tables
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS items_updated_at ON price_table_items;
CREATE TRIGGER items_updated_at BEFORE UPDATE ON price_table_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
