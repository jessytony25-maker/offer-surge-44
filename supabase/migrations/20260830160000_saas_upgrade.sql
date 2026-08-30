-- =========================================================
-- OFERTA HUB — UPGRADE SAAS COMPLETO
-- Migração incremental: adiciona tabelas e campos sem
-- remover nada existente.
-- =========================================================

-- ============ EXTENSÕES DE TIPOS ============
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'operation_mode') THEN
    CREATE TYPE public.operation_mode AS ENUM ('manual', 'semi_auto', 'pilot');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pilot_status') THEN
    CREATE TYPE public.pilot_status AS ENUM ('off', 'on', 'paused', 'error');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'plan_tier_v2') THEN
    CREATE TYPE public.plan_tier_v2 AS ENUM ('free', 'starter', 'pro', 'premium');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'alert_status') THEN
    CREATE TYPE public.alert_status AS ENUM ('active', 'triggered', 'paused', 'expired');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'health_status') THEN
    CREATE TYPE public.health_status AS ENUM ('operational', 'degraded', 'error', 'unknown');
  END IF;
END $$;

-- ============ HISTÓRICO REAL DE PREÇOS ============
CREATE TABLE IF NOT EXISTS public.offer_price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  offer_id uuid REFERENCES public.offers(id) ON DELETE CASCADE,
  marketplace text NOT NULL,
  price numeric(12,2) NOT NULL,
  promo_price numeric(12,2),
  original_price numeric(12,2),
  coupon text,
  free_shipping boolean NOT NULL DEFAULT false,
  available boolean NOT NULL DEFAULT true,
  captured_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_price_history_product ON public.offer_price_history(product_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_price_history_offer ON public.offer_price_history(offer_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_price_history_user ON public.offer_price_history(user_id, marketplace, captured_at DESC);

-- ============ DESEMPENHO DE OFERTAS ============
CREATE TABLE IF NOT EXISTS public.offer_performance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  offer_id uuid REFERENCES public.offers(id) ON DELETE CASCADE,
  publication_id uuid REFERENCES public.publications(id) ON DELETE SET NULL,
  group_id uuid REFERENCES public.groups(id) ON DELETE SET NULL,
  template_id uuid REFERENCES public.templates(id) ON DELETE SET NULL,
  marketplace text,
  category text,
  impressions int NOT NULL DEFAULT 0,
  clicks int NOT NULL DEFAULT 0,
  sales int NOT NULL DEFAULT 0,
  commission numeric(12,2) NOT NULL DEFAULT 0,
  ctr numeric(6,4) NOT NULL DEFAULT 0,
  conversion_rate numeric(6,4) NOT NULL DEFAULT 0,
  publish_hour int,  -- 0-23
  publish_day_of_week int,  -- 0=Sun 6=Sat
  copy_style text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_offer_perf_user ON public.offer_performance(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_offer_perf_group ON public.offer_performance(group_id, created_at DESC);

-- ============ DESEMPENHO DE GRUPOS ============
CREATE TABLE IF NOT EXISTS public.group_performance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  period_date date NOT NULL DEFAULT CURRENT_DATE,
  clicks int NOT NULL DEFAULT 0,
  sales int NOT NULL DEFAULT 0,
  commission numeric(12,2) NOT NULL DEFAULT 0,
  ctr numeric(6,4) NOT NULL DEFAULT 0,
  conversion_rate numeric(6,4) NOT NULL DEFAULT 0,
  publications_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, group_id, period_date)
);
CREATE INDEX IF NOT EXISTS idx_group_perf_user ON public.group_performance(user_id, period_date DESC);

-- ============ EXPERIMENTOS A/B DE COPY ============
CREATE TABLE IF NOT EXISTS public.copy_experiments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  group_id uuid REFERENCES public.groups(id) ON DELETE SET NULL,
  offer_id uuid REFERENCES public.offers(id) ON DELETE SET NULL,
  template_a_id uuid REFERENCES public.templates(id) ON DELETE SET NULL,
  template_b_id uuid REFERENCES public.templates(id) ON DELETE SET NULL,
  template_a_style text,
  template_b_style text,
  clicks_a int NOT NULL DEFAULT 0,
  clicks_b int NOT NULL DEFAULT 0,
  conversions_a int NOT NULL DEFAULT 0,
  conversions_b int NOT NULL DEFAULT 0,
  commission_a numeric(12,2) NOT NULL DEFAULT 0,
  commission_b numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'running',  -- running, winner_a, winner_b, inconclusive, paused
  winner text,  -- 'a', 'b', null
  min_sample_size int NOT NULL DEFAULT 30,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============ ALERTAS DE PREÇO ============
CREATE TABLE IF NOT EXISTS public.price_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  marketplace text,
  product_title text NOT NULL,
  target_price numeric(12,2) NOT NULL,
  current_price numeric(12,2),
  status public.alert_status NOT NULL DEFAULT 'active',
  action text NOT NULL DEFAULT 'notify',  -- notify, queue, auto_publish
  last_checked_at timestamptz,
  triggered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_price_alerts_user ON public.price_alerts(user_id, status);

-- ============ LINKS DE RASTREAMENTO (SubID) ============
CREATE TABLE IF NOT EXISTS public.tracking_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  offer_id uuid REFERENCES public.offers(id) ON DELETE CASCADE,
  group_id uuid REFERENCES public.groups(id) ON DELETE SET NULL,
  marketplace text NOT NULL,
  original_url text NOT NULL,
  affiliate_url text,
  sub_id text,
  campaign text,
  clicks int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tracking_user ON public.tracking_links(user_id, created_at DESC);

-- ============ EXECUÇÕES DE AUTOMAÇÃO ============
CREATE TABLE IF NOT EXISTS public.automation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  automation_id uuid REFERENCES public.automations(id) ON DELETE SET NULL,
  trigger_type text NOT NULL,  -- scheduled, manual, pilot, price_alert
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  offers_analyzed int NOT NULL DEFAULT 0,
  offers_queued int NOT NULL DEFAULT 0,
  offers_skipped int NOT NULL DEFAULT 0,
  offers_failed int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'running',  -- running, success, failed, aborted
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_automation_runs_user ON public.automation_runs(user_id, started_at DESC);

-- ============ NOTIFICAÇÕES DO SISTEMA ============
CREATE TABLE IF NOT EXISTS public.system_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,  -- new_offer, wa_disconnected, tg_error, api_error, sale, goal, pilot_paused, limit_reached, price_alert
  title text NOT NULL,
  body text,
  icon text,
  priority text NOT NULL DEFAULT 'normal',  -- low, normal, high, urgent
  read boolean NOT NULL DEFAULT false,
  action_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sys_notif_user ON public.system_notifications(user_id, read, created_at DESC);

-- ============ SAÚDE DAS INTEGRAÇÕES ============
CREATE TABLE IF NOT EXISTS public.channel_health (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  channel text NOT NULL,  -- shopee, mercadolivre, amazon, shein, whatsapp, telegram
  status public.health_status NOT NULL DEFAULT 'unknown',
  last_sync_at timestamptz,
  last_error text,
  last_error_at timestamptz,
  failure_count int NOT NULL DEFAULT 0,
  response_time_ms int,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, channel)
);

-- ============ FILA DE RETRY INTELIGENTE ============
CREATE TABLE IF NOT EXISTS public.retry_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type text NOT NULL,  -- publication, automation_run, price_check
  entity_id uuid NOT NULL,
  attempt int NOT NULL DEFAULT 1,
  max_attempts int NOT NULL DEFAULT 3,
  next_retry_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  status text NOT NULL DEFAULT 'pending',  -- pending, processing, success, failed
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_retry_queue_user ON public.retry_queue(user_id, status, next_retry_at);

-- ============ PREFERÊNCIAS DO USUÁRIO ============
CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  operation_mode public.operation_mode NOT NULL DEFAULT 'manual',
  pilot_status public.pilot_status NOT NULL DEFAULT 'off',
  emergency_stop boolean NOT NULL DEFAULT false,
  global_daily_limit int NOT NULL DEFAULT 100,
  global_hourly_limit int NOT NULL DEFAULT 20,
  global_min_interval_minutes int NOT NULL DEFAULT 10,
  global_min_score int NOT NULL DEFAULT 60,
  duplicate_window_hours int NOT NULL DEFAULT 24,
  anti_spam_enabled boolean NOT NULL DEFAULT true,
  notifications_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============ MARCA/ASSINATURA DO USUÁRIO ============
CREATE TABLE IF NOT EXISTS public.user_brand (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_name text,
  channel_name text,
  instagram text,
  cta text DEFAULT 'CONFIRA A OFERTA',
  emoji text DEFAULT '🔥',
  signature text,
  default_sub_id text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============ LIMITES POR PLANO ============
CREATE TABLE IF NOT EXISTS public.plan_limits (
  plan text PRIMARY KEY,  -- free, starter, pro, premium
  max_groups int NOT NULL DEFAULT 5,
  max_connections int NOT NULL DEFAULT 1,
  max_marketplaces int NOT NULL DEFAULT 2,
  max_offers_per_day int NOT NULL DEFAULT 50,
  max_automations int NOT NULL DEFAULT 3,
  max_publications_per_day int NOT NULL DEFAULT 30,
  allow_pilot_auto boolean NOT NULL DEFAULT false,
  allow_ab_test boolean NOT NULL DEFAULT false,
  allow_price_alerts boolean NOT NULL DEFAULT false,
  allow_analytics boolean NOT NULL DEFAULT false,
  history_days int NOT NULL DEFAULT 30,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.plan_limits (plan, max_groups, max_connections, max_marketplaces, max_offers_per_day, max_automations, max_publications_per_day, allow_pilot_auto, allow_ab_test, allow_price_alerts, allow_analytics, history_days) VALUES
  ('free',     3,  1, 1,  20,  2,  10, false, false, false, false, 7),
  ('starter',  10, 2, 2,  100, 5,  50, false, false, true,  true,  30),
  ('pro',      30, 5, 4,  500, 20, 200, true, true,  true,  true,  90),
  ('premium',  999,999,999,9999,999,9999,true, true,  true,  true,  365)
ON CONFLICT (plan) DO NOTHING;

-- ============ CONFIGURAÇÕES DO ADMIN ============
CREATE TABLE IF NOT EXISTS public.admin_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.admin_settings (key, value, description) VALUES
  ('score_weights', '{"discount":22,"price":8,"priceHistory":10,"rating":12,"ratingCount":8,"sales":12,"commission":14,"coupon":5,"shipping":4,"availability":3,"popularity":6,"category":4}', 'Pesos globais do Offer Score'),
  ('anti_spam_rules', '{"maxPerHour":20,"maxPerDay":100,"minIntervalMinutes":10,"duplicateWindowHours":24}', 'Regras globais anti-spam'),
  ('enabled_marketplaces', '["shopee","mercadolivre","amazon","shein"]', 'Marketplaces habilitados'),
  ('enabled_channels', '["whatsapp","telegram"]', 'Canais habilitados')
ON CONFLICT (key) DO NOTHING;

-- ============ EXTENSÕES DE TABELAS EXISTENTES ============

-- groups: perfil inteligente
ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS niche text,
  ADD COLUMN IF NOT EXISTS positive_keywords text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS negative_keywords text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS min_commission_pct numeric(6,2),
  ADD COLUMN IF NOT EXISTS min_price numeric(12,2),
  ADD COLUMN IF NOT EXISTS max_price numeric(12,2),
  ADD COLUMN IF NOT EXISTS priority int NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS sub_id text,
  ADD COLUMN IF NOT EXISTS blocked_categories text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS allowed_marketplaces text[] NOT NULL DEFAULT '{"shopee","mercadolivre","amazon","shein"}';

-- offers: dados de histórico calculado
ALTER TABLE public.offers
  ADD COLUMN IF NOT EXISTS real_discount_pct numeric(6,2),
  ADD COLUMN IF NOT EXISTS historic_min_price numeric(12,2),
  ADD COLUMN IF NOT EXISTS historic_avg_price numeric(12,2),
  ADD COLUMN IF NOT EXISTS historic_samples int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS segmentation_tags text[] NOT NULL DEFAULT '{}';

-- automations: modo de operação
ALTER TABLE public.automations
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS max_per_hour int NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS min_score int NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS allowed_marketplaces text[] NOT NULL DEFAULT '{"shopee","mercadolivre","amazon","shein"}';

-- ============ TRIGGERS updated_at ============
DO $$
DECLARE t text;
DECLARE new_tables text[] := ARRAY[
  'offer_performance','group_performance','copy_experiments',
  'price_alerts','channel_health','retry_queue','automation_runs'
];
BEGIN
  FOREACH t IN ARRAY new_tables LOOP
    BEGIN
      EXECUTE format(
        'CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()',
        t||'_updated_at', t
      );
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END LOOP;
END $$;

-- ============ ROW LEVEL SECURITY ============
DO $$
DECLARE t text;
DECLARE new_owner_tables text[] := ARRAY[
  'offer_price_history','offer_performance','group_performance',
  'copy_experiments','price_alerts','tracking_links','automation_runs',
  'system_notifications','channel_health','retry_queue'
];
BEGIN
  FOREACH t IN ARRAY new_owner_tables LOOP
    BEGIN
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
      EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),''admin''))', t||'_select', t);
      EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid())', t||'_insert', t);
      EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())', t||'_update', t);
      EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (user_id = auth.uid())', t||'_delete', t);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END LOOP;
END $$;

-- Tabelas chave única por user_id
DO $$
DECLARE t text;
DECLARE single_tables text[] := ARRAY['user_preferences','user_brand'];
BEGIN
  FOREACH t IN ARRAY single_tables LOOP
    BEGIN
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
      EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())', t||'_owner', t);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END LOOP;
END $$;

-- plan_limits e admin_settings: leitura pública autenticada
GRANT SELECT ON public.plan_limits TO authenticated;
GRANT ALL ON public.plan_limits TO service_role;
ALTER TABLE public.plan_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plan_limits_read" ON public.plan_limits FOR SELECT TO authenticated USING (true);

GRANT SELECT ON public.admin_settings TO authenticated;
GRANT ALL ON public.admin_settings TO service_role;
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_settings_read" ON public.admin_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_settings_write" ON public.admin_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ VIEW ÚTIL: PREÇOS HISTÓRICOS AGREGADOS ============
CREATE OR REPLACE VIEW public.v_price_history_stats AS
SELECT
  ph.user_id,
  ph.product_id,
  ph.marketplace,
  COUNT(*) AS sample_count,
  MIN(COALESCE(ph.promo_price, ph.price)) AS min_price,
  MAX(COALESCE(ph.promo_price, ph.price)) AS max_price,
  AVG(COALESCE(ph.promo_price, ph.price)) AS avg_price,
  AVG(CASE WHEN ph.captured_at >= now() - interval '7 days' THEN COALESCE(ph.promo_price, ph.price) END) AS avg_7d,
  AVG(CASE WHEN ph.captured_at >= now() - interval '30 days' THEN COALESCE(ph.promo_price, ph.price) END) AS avg_30d,
  AVG(CASE WHEN ph.captured_at >= now() - interval '90 days' THEN COALESCE(ph.promo_price, ph.price) END) AS avg_90d,
  MAX(ph.captured_at) AS last_captured_at
FROM public.offer_price_history ph
GROUP BY ph.user_id, ph.product_id, ph.marketplace;

GRANT SELECT ON public.v_price_history_stats TO authenticated;

-- ============ VIEW ÚTIL: RANKING DE GRUPOS ============
CREATE OR REPLACE VIEW public.v_group_ranking AS
SELECT
  gp.user_id,
  gp.group_id,
  g.name AS group_name,
  g.platform,
  SUM(gp.clicks) AS total_clicks,
  SUM(gp.sales) AS total_sales,
  SUM(gp.commission) AS total_commission,
  SUM(gp.publications_count) AS total_publications,
  CASE WHEN SUM(gp.publications_count) > 0
    THEN SUM(gp.clicks)::numeric / SUM(gp.publications_count)
    ELSE 0
  END AS avg_ctr,
  CASE WHEN SUM(gp.clicks) > 0
    THEN SUM(gp.sales)::numeric / SUM(gp.clicks)
    ELSE 0
  END AS avg_conversion
FROM public.group_performance gp
JOIN public.groups g ON g.id = gp.group_id
GROUP BY gp.user_id, gp.group_id, g.name, g.platform;

GRANT SELECT ON public.v_group_ranking TO authenticated;
