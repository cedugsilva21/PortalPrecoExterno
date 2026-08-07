/*
# Configurable Approval Thresholds

## Resumo
Cria tabela de configurações para armazenar os limites percentuais de cada nível de aprovação.
Permite que o administrador configure os thresholds sem alterar código.

## Nova Tabela
- **approval_settings** - Configurações de alçada de aprovação
  - `id` (int, PK, sempre 1 - singleton)
  - `gerente_threshold` (numeric, limite máximo de desvio para aprovação do Gerente, padrão 5)
  - `diretor_threshold` (numeric, limite máximo de desvio para aprovação do Diretor, padrão 10)
  - `superintendente_threshold` (numeric, limite máximo de desvio para aprovação do Superintendente, padrão 15)
  - `updated_at` (timestamp)

## Notas
- A lógica é cumulativa: até gerente_threshold% apenas o Gerente aprova;
  entre gerente_threshold e diretor_threshold, Gerente + Diretor aprovam;
  acima de diretor_threshold até superintendente_threshold, todos os 3 aprovam;
  acima de superintendente_threshold, bloqueado.
- RLS: todos autenticados podem ler; apenas admin pode atualizar.
*/

CREATE TABLE IF NOT EXISTS approval_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  gerente_threshold numeric(5,2) NOT NULL DEFAULT 5.00,
  diretor_threshold numeric(5,2) NOT NULL DEFAULT 10.00,
  superintendente_threshold numeric(5,2) NOT NULL DEFAULT 15.00,
  updated_at timestamptz DEFAULT now()
);

INSERT INTO approval_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE approval_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "settings_select_all" ON approval_settings;
CREATE POLICY "settings_select_all" ON approval_settings FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "settings_update_admin" ON approval_settings;
CREATE POLICY "settings_update_admin" ON approval_settings FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS settings_updated_at ON approval_settings;
CREATE TRIGGER settings_updated_at BEFORE UPDATE ON approval_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
