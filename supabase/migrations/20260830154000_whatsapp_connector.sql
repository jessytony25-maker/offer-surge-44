-- =========================================================
-- MÓDULO: WHATSAPP CONNECTOR (ESTRUTURA DE BANCO DE DADOS)
-- =========================================================

-- 1. TABELA DE CONEXÕES / SESSÕES DO WHATSAPP
CREATE TABLE IF NOT EXISTS public.whatsapp_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'whatsapp_web',
  session_identifier text NOT NULL UNIQUE,
  phone_number text,
  display_name text,
  status text NOT NULL DEFAULT 'waiting_qr', -- waiting_qr, qr_ready, waiting_scan, connecting, connected, disconnected, error
  qr_code text,
  connected_at timestamptz,
  last_seen_at timestamptz,
  disconnected_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wa_conn_user_id ON public.whatsapp_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_wa_conn_status ON public.whatsapp_connections(status);

-- 2. TABELA DE GRUPOS DO WHATSAPP
CREATE TABLE IF NOT EXISTS public.whatsapp_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES public.whatsapp_connections(id) ON DELETE CASCADE,
  external_group_id text NOT NULL,
  name text NOT NULL,
  description text,
  participant_count int NOT NULL DEFAULT 0,
  image_url text,
  category_id text DEFAULT 'geral',
  is_selected boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  daily_limit int NOT NULL DEFAULT 10,
  minimum_offer_score int NOT NULL DEFAULT 80,
  minimum_discount int NOT NULL DEFAULT 30,
  allowed_start_time text NOT NULL DEFAULT '08:00',
  allowed_end_time text NOT NULL DEFAULT '22:00',
  posting_interval_minutes int NOT NULL DEFAULT 30,
  allowed_marketplaces text[] NOT NULL DEFAULT '{"shopee","mercadolivre","amazon","shein"}',
  allowed_categories text[] NOT NULL DEFAULT '{"casa","beleza","eletronicos","moda","esportes"}',
  copy_template text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_synced_at timestamptz,
  UNIQUE (user_id, external_group_id)
);

CREATE INDEX IF NOT EXISTS idx_wa_groups_user_id ON public.whatsapp_groups(user_id);
CREATE INDEX IF NOT EXISTS idx_wa_groups_selected ON public.whatsapp_groups(user_id, is_selected, is_active);

-- 3. TABELA DE FILA DE PUBLICAÇÃO DO WHATSAPP
CREATE TABLE IF NOT EXISTS public.whatsapp_publication_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connection_id uuid REFERENCES public.whatsapp_connections(id) ON DELETE SET NULL,
  group_id uuid NOT NULL REFERENCES public.whatsapp_groups(id) ON DELETE CASCADE,
  offer_id text,
  message text NOT NULL,
  media_url text,
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending', -- pending, scheduled, processing, sent, failed, cancelled
  attempts int NOT NULL DEFAULT 0,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wa_queue_user_status ON public.whatsapp_publication_queue(user_id, status);
CREATE INDEX IF NOT EXISTS idx_wa_queue_group ON public.whatsapp_publication_queue(group_id);

-- 4. TABELA DE LOGS DE AUDITORIA DO WHATSAPP
CREATE TABLE IF NOT EXISTS public.whatsapp_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connection_id uuid REFERENCES public.whatsapp_connections(id) ON DELETE SET NULL,
  group_name text,
  offer_title text,
  status text NOT NULL, -- sent, failed, skipped
  reason text,
  attempt int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wa_logs_user_id ON public.whatsapp_logs(user_id, created_at DESC);

-- 5. TABELA DE CONFIGURAÇÕES GLOBAIS DO WHATSAPP
CREATE TABLE IF NOT EXISTS public.whatsapp_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  duplicate_window_hours int NOT NULL DEFAULT 24, -- 1, 6, 12, 24, 48, 168 (7 dias)
  global_daily_limit int NOT NULL DEFAULT 50,
  global_min_interval_minutes int NOT NULL DEFAULT 15,
  pause_on_disconnect boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- =========================================================
-- TRIGGERS DE UPDATED_AT
-- =========================================================
CREATE TRIGGER set_whatsapp_connections_updated_at
BEFORE UPDATE ON public.whatsapp_connections
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_whatsapp_groups_updated_at
BEFORE UPDATE ON public.whatsapp_groups
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_whatsapp_publication_queue_updated_at
BEFORE UPDATE ON public.whatsapp_publication_queue
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- ROW LEVEL SECURITY (ISOLAMENTO ESTRITO POR USUÁRIO)
-- =========================================================
ALTER TABLE public.whatsapp_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_publication_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own whatsapp connections"
  ON public.whatsapp_connections FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage own whatsapp groups"
  ON public.whatsapp_groups FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage own whatsapp queue"
  ON public.whatsapp_publication_queue FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own whatsapp logs"
  ON public.whatsapp_logs FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage own whatsapp settings"
  ON public.whatsapp_settings FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
