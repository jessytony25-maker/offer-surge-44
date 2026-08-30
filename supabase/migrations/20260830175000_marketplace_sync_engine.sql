-- =========================================================
-- MIGRATION: MARKETPLACE SYNC ENGINE & AUTO-SYNC
-- =========================================================

-- Adiciona a coluna de intervalo de sincronização automática na tabela marketplace_connections se não existir
ALTER TABLE public.marketplace_connections
  ADD COLUMN IF NOT EXISTS auto_sync_interval text NOT NULL DEFAULT 'disabled';

-- Adiciona colunas adicionais para detalhamento de ofertas
ALTER TABLE public.offers
  ADD COLUMN IF NOT EXISTS external_product_id text,
  ADD COLUMN IF NOT EXISTS review_count int,
  ADD COLUMN IF NOT EXISTS affiliate_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS synced_at timestamptz DEFAULT now();

-- Cria índices para performance nas buscas por ID externo e sincronização
CREATE INDEX IF NOT EXISTS idx_offers_ext_product ON public.offers(user_id, marketplace, external_product_id);
CREATE INDEX IF NOT EXISTS idx_offers_synced_at ON public.offers(synced_at);

-- Tabela de Logs de Sincronização de Marketplaces
CREATE TABLE IF NOT EXISTS public.marketplace_sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  marketplace text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running', -- running, completed, partial_success, error
  items_found int NOT NULL DEFAULT 0,
  items_imported int NOT NULL DEFAULT 0,
  items_updated int NOT NULL DEFAULT 0,
  items_skipped int NOT NULL DEFAULT 0,
  error_count int NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sync_logs_user_mkt ON public.marketplace_sync_logs(user_id, marketplace);
CREATE INDEX IF NOT EXISTS idx_sync_logs_created ON public.marketplace_sync_logs(created_at DESC);

-- RLS para a tabela de logs
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketplace_sync_logs TO authenticated;
GRANT ALL ON public.marketplace_sync_logs TO service_role;
ALTER TABLE public.marketplace_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sync_logs_select" ON public.marketplace_sync_logs
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "sync_logs_insert" ON public.marketplace_sync_logs
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "sync_logs_update" ON public.marketplace_sync_logs
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "sync_logs_delete" ON public.marketplace_sync_logs
  FOR DELETE TO authenticated USING (user_id = auth.uid());
