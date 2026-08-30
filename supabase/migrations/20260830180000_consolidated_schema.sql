-- ============================================================================
-- OFERTA HUB — CONSOLIDATED PRODUCTION DATABASE SCHEMA
-- ============================================================================

-- ============ 1. EXTENSÕES & ENUMS ============
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('admin','user');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'plan_tier') THEN
    CREATE TYPE public.plan_tier AS ENUM ('free','basic','pro','business');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'connection_status') THEN
    CREATE TYPE public.connection_status AS ENUM ('not_configured','pending','connected','error','disconnected');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'offer_status') THEN
    CREATE TYPE public.offer_status AS ENUM ('new','approved','rejected','queued','published','archived');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'queue_status') THEN
    CREATE TYPE public.queue_status AS ENUM ('pending','scheduled','processing','published','failed','cancelled');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'channel_platform') THEN
    CREATE TYPE public.channel_platform AS ENUM ('whatsapp','telegram','other');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'source_type') THEN
    CREATE TYPE public.source_type AS ENUM ('marketplace','channel','group','feed','api','external');
  END IF;
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

-- ============ 2. FUNÇÕES HELPERS GLOBAIS ============
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ============ 3. PROFILES / ROLES / SUBSCRIPTIONS ============
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  company text,
  avatar_url text,
  phone text,
  demo_mode boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  plan public.plan_tier NOT NULL DEFAULT 'free',
  status text NOT NULL DEFAULT 'active',
  current_period_end timestamptz,
  provider text,
  provider_customer_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)))
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;
  INSERT INTO public.subscriptions (user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created') THEN
    CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  END IF;
END $$;

-- Permissões das funções
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

-- ============ 4. CATALOG (GLOBAL) ============
CREATE TABLE IF NOT EXISTS public.marketplaces (
  slug text PRIMARY KEY,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#6b7280',
  short_label text NOT NULL DEFAULT '',
  docs_url text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0
);

INSERT INTO public.marketplaces (slug,name,color,short_label,sort_order) VALUES
  ('shopee','Shopee','#ee4d2d','Sh',1),
  ('mercadolivre','Mercado Livre','#0ea5e9','ML',2),
  ('amazon','Amazon','#f59e0b','Am',3),
  ('shein','SHEIN','#c1121f','SN',4)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  color = EXCLUDED.color,
  short_label = EXCLUDED.short_label,
  sort_order = EXCLUDED.sort_order;

CREATE TABLE IF NOT EXISTS public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.categories (name, slug) VALUES
  ('Casa','casa'),('Eletrônicos','eletronicos'),('Moda','moda'),('Beleza','beleza'),
  ('Cozinha','cozinha'),('Esporte','esporte'),('Infantil','infantil'),('Pet','pet')
ON CONFLICT DO NOTHING;

-- ============ 5. INTEGRATIONS ============
CREATE TABLE IF NOT EXISTS public.marketplace_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  marketplace text NOT NULL REFERENCES public.marketplaces(slug),
  status public.connection_status NOT NULL DEFAULT 'not_configured',
  last_sync_at timestamptz,
  last_error text,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  auto_sync_interval text NOT NULL DEFAULT 'disabled',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, marketplace)
);

CREATE TABLE IF NOT EXISTS public.affiliate_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  marketplace text NOT NULL REFERENCES public.marketplaces(slug),
  affiliate_id text,
  tracking_id text,
  sub_id text,
  api_key_set boolean NOT NULL DEFAULT false,
  api_secret_set boolean NOT NULL DEFAULT false,
  extra_params jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, marketplace)
);

CREATE TABLE IF NOT EXISTS public.integration_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('marketplace','channel')),
  provider text NOT NULL,
  credentials jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind, provider)
);

CREATE TABLE IF NOT EXISTS public.channel_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform public.channel_platform NOT NULL,
  status public.connection_status NOT NULL DEFAULT 'not_configured',
  last_error text,
  last_test_at timestamptz,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, platform)
);

-- ============ 6. PRODUCTS / OFFERS ============
CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  marketplace text NOT NULL REFERENCES public.marketplaces(slug),
  external_id text,
  sku text,
  title text NOT NULL,
  image_url text,
  url text,
  category text,
  rating numeric(3,2),
  rating_count int,
  sales_count int,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.product_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  marketplace text NOT NULL,
  price numeric(12,2) NOT NULL,
  promo_price numeric(12,2),
  coupon text,
  available boolean NOT NULL DEFAULT true,
  captured_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  marketplace text NOT NULL REFERENCES public.marketplaces(slug),
  title text NOT NULL,
  image_url text,
  category text,
  previous_price numeric(12,2),
  price numeric(12,2) NOT NULL,
  discount_pct int NOT NULL DEFAULT 0,
  rating numeric(3,2),
  rating_count int,
  sales_count int,
  coupon text,
  commission numeric(12,2),
  commission_pct numeric(6,2),
  free_shipping boolean NOT NULL DEFAULT false,
  available boolean NOT NULL DEFAULT true,
  original_url text,
  affiliate_url text,
  score int NOT NULL DEFAULT 0,
  status public.offer_status NOT NULL DEFAULT 'new',
  fingerprint text,
  source_id uuid,
  is_demo boolean NOT NULL DEFAULT false,
  
  -- Campos adicionais
  external_product_id text,
  review_count int,
  affiliate_status text NOT NULL DEFAULT 'pending', -- pending, resolved, failed
  source text,
  synced_at timestamptz DEFAULT now(),
  
  -- Campos de histórico calculado
  real_discount_pct numeric(6,2),
  historic_min_price numeric(12,2),
  historic_avg_price numeric(12,2),
  historic_samples int NOT NULL DEFAULT 0,
  segmentation_tags text[] NOT NULL DEFAULT '{}',
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS offers_user_created_idx ON public.offers (user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS offers_user_fingerprint_idx ON public.offers (user_id, fingerprint) WHERE fingerprint IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_offers_ext_product ON public.offers (user_id, marketplace, external_product_id);
CREATE INDEX IF NOT EXISTS idx_offers_synced_at ON public.offers (synced_at);

CREATE TABLE IF NOT EXISTS public.offer_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  offer_id uuid NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
  score int NOT NULL,
  breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.offer_score_weights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  weights jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  marketplace text REFERENCES public.marketplaces(slug),
  code text NOT NULL,
  description text,
  discount_text text,
  valid_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============ 7. CHANNELS / GROUPS ============
CREATE TABLE IF NOT EXISTS public.templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  title text,
  body text NOT NULL DEFAULT '',
  cta text,
  signature text,
  use_emojis boolean NOT NULL DEFAULT true,
  style text NOT NULL DEFAULT 'promocional',
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  platform public.channel_platform NOT NULL DEFAULT 'telegram',
  identifier text,
  category text,
  status public.connection_status NOT NULL DEFAULT 'not_configured',
  active boolean NOT NULL DEFAULT true,
  allowed_start time NOT NULL DEFAULT '08:00',
  allowed_end time NOT NULL DEFAULT '22:00',
  daily_limit int NOT NULL DEFAULT 10,
  interval_minutes int NOT NULL DEFAULT 30,
  allowed_categories text[] NOT NULL DEFAULT '{}',
  min_score int NOT NULL DEFAULT 60,
  template_id uuid REFERENCES public.templates(id) ON DELETE SET NULL,
  
  -- Campos adicionais de perfil inteligente
  niche text,
  positive_keywords text[] NOT NULL DEFAULT '{}',
  negative_keywords text[] NOT NULL DEFAULT '{}',
  min_commission_pct numeric(6,2),
  min_price numeric(12,2),
  max_price numeric(12,2),
  priority int NOT NULL DEFAULT 5,
  sub_id text,
  blocked_categories text[] NOT NULL DEFAULT '{}',
  allowed_marketplaces text[] NOT NULL DEFAULT '{"shopee","mercadolivre","amazon","shein"}',

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.group_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  field text NOT NULL,
  operator text NOT NULL,
  value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  type public.source_type NOT NULL DEFAULT 'marketplace',
  identifier text,
  marketplace text REFERENCES public.marketplaces(slug),
  status public.connection_status NOT NULL DEFAULT 'not_configured',
  authorized boolean NOT NULL DEFAULT false,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.source_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  source_id uuid NOT NULL REFERENCES public.sources(id) ON DELETE CASCADE,
  raw_text text,
  link text,
  image_url text,
  marketplace text,
  processed boolean NOT NULL DEFAULT false,
  offer_id uuid REFERENCES public.offers(id) ON DELETE SET NULL,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  group_id uuid REFERENCES public.groups(id) ON DELETE SET NULL,
  template_id uuid REFERENCES public.templates(id) ON DELETE SET NULL,
  start_time time NOT NULL DEFAULT '08:00',
  end_time time NOT NULL DEFAULT '22:00',
  daily_limit int NOT NULL DEFAULT 10,
  interval_minutes int NOT NULL DEFAULT 30,
  
  -- Campos adicionais de modo de operação
  mode text NOT NULL DEFAULT 'manual',
  max_per_hour int NOT NULL DEFAULT 10,
  min_score int NOT NULL DEFAULT 60,
  allowed_marketplaces text[] NOT NULL DEFAULT '{"shopee","mercadolivre","amazon","shein"}',

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.automation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  automation_id uuid NOT NULL REFERENCES public.automations(id) ON DELETE CASCADE,
  field text NOT NULL,
  operator text NOT NULL DEFAULT 'gte',
  value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============ 8. QUEUE / PUBLICATIONS ============
CREATE TABLE IF NOT EXISTS public.publication_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  offer_id uuid REFERENCES public.offers(id) ON DELETE CASCADE,
  group_id uuid REFERENCES public.groups(id) ON DELETE SET NULL,
  template_id uuid REFERENCES public.templates(id) ON DELETE SET NULL,
  automation_id uuid REFERENCES public.automations(id) ON DELETE SET NULL,
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  status public.queue_status NOT NULL DEFAULT 'pending',
  attempts int NOT NULL DEFAULT 0,
  last_error text,
  content text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.publications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  offer_id uuid REFERENCES public.offers(id) ON DELETE SET NULL,
  group_id uuid REFERENCES public.groups(id) ON DELETE SET NULL,
  template_id uuid REFERENCES public.templates(id) ON DELETE SET NULL,
  marketplace text,
  title text,
  link text,
  content text,
  status public.queue_status NOT NULL DEFAULT 'published',
  attempts int NOT NULL DEFAULT 1,
  error text,
  published_at timestamptz NOT NULL DEFAULT now()
);

-- ============ 9. METRICS & AUDIT ============
CREATE TABLE IF NOT EXISTS public.clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  offer_id uuid REFERENCES public.offers(id) ON DELETE SET NULL,
  publication_id uuid REFERENCES public.publications(id) ON DELETE SET NULL,
  marketplace text,
  group_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.conversions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  offer_id uuid REFERENCES public.offers(id) ON DELETE SET NULL,
  publication_id uuid REFERENCES public.publications(id) ON DELETE SET NULL,
  marketplace text,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'confirmed',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  conversion_id uuid REFERENCES public.conversions(id) ON DELETE CASCADE,
  offer_id uuid REFERENCES public.offers(id) ON DELETE SET NULL,
  marketplace text,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'info',
  title text NOT NULL,
  body text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  channel text NOT NULL DEFAULT 'app',
  action text NOT NULL,
  entity text,
  entity_id text,
  level text NOT NULL DEFAULT 'info',
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============ 10. REAL WHATSAPP MODULE ============
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
  
  -- Parâmetros do Gateway Real
  api_url text,
  api_key text,
  instance_name text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

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

CREATE TABLE IF NOT EXISTS public.whatsapp_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  duplicate_window_hours int NOT NULL DEFAULT 24,
  global_daily_limit int NOT NULL DEFAULT 50,
  global_min_interval_minutes int NOT NULL DEFAULT 15,
  pause_on_disconnect boolean NOT NULL DEFAULT true,
  
  -- Campos adicionais de gateway padrão
  default_api_url text,
  default_api_key text,

  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============ 11. ANALYTICS / SAAS ENGINE TABLES ============
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
  publish_hour int,
  publish_day_of_week int,
  copy_style text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

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
  status text NOT NULL DEFAULT 'running',
  winner text,
  min_sample_size int NOT NULL DEFAULT 30,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.price_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  marketplace text,
  product_title text NOT NULL,
  target_price numeric(12,2) NOT NULL,
  current_price numeric(12,2),
  status public.alert_status NOT NULL DEFAULT 'active',
  action text NOT NULL DEFAULT 'notify',
  last_checked_at timestamptz,
  triggered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

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
  commission numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.automation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  automation_id uuid REFERENCES public.automations(id) ON DELETE SET NULL,
  trigger_type text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  offers_analyzed int NOT NULL DEFAULT 0,
  offers_queued int NOT NULL DEFAULT 0,
  offers_skipped int NOT NULL DEFAULT 0,
  offers_failed int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'running',
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.system_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  icon text,
  priority text NOT NULL DEFAULT 'normal',
  read boolean NOT NULL DEFAULT false,
  action_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.channel_health (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  channel text NOT NULL,
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

CREATE TABLE IF NOT EXISTS public.retry_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  attempt int NOT NULL DEFAULT 1,
  max_attempts int NOT NULL DEFAULT 3,
  next_retry_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

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

CREATE TABLE IF NOT EXISTS public.plan_limits (
  plan text PRIMARY KEY,
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
ON CONFLICT (plan) DO UPDATE SET
  max_groups = EXCLUDED.max_groups,
  max_connections = EXCLUDED.max_connections,
  max_marketplaces = EXCLUDED.max_marketplaces,
  max_offers_per_day = EXCLUDED.max_offers_per_day,
  max_automations = EXCLUDED.max_automations,
  max_publications_per_day = EXCLUDED.max_publications_per_day,
  allow_pilot_auto = EXCLUDED.allow_pilot_auto,
  allow_ab_test = EXCLUDED.allow_ab_test,
  allow_price_alerts = EXCLUDED.allow_price_alerts,
  allow_analytics = EXCLUDED.allow_analytics,
  history_days = EXCLUDED.history_days;

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
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description;

-- ============ 12. AFFILIATE LINKS & SYNC ENGINE ============
CREATE TABLE IF NOT EXISTS public.affiliate_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  offer_id uuid REFERENCES public.offers(id) ON DELETE SET NULL,
  marketplace text NOT NULL,
  original_url text NOT NULL,
  affiliate_url text NOT NULL,
  affiliate_program text NOT NULL,
  method text NOT NULL DEFAULT 'auto',
  tracking_id text,
  sub_id text,
  clicks int NOT NULL DEFAULT 0,
  last_used_at timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, marketplace, original_url, sub_id)
);

CREATE INDEX IF NOT EXISTS idx_aff_links_user_market ON public.affiliate_links(user_id, marketplace);
CREATE INDEX IF NOT EXISTS idx_aff_links_original ON public.affiliate_links(user_id, original_url);
CREATE INDEX IF NOT EXISTS idx_aff_links_offer ON public.affiliate_links(offer_id);

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

-- ============ 13. TRIGGERS updated_at ============
DO $$
DECLARE t text;
DECLARE tables_to_trigger text[] := ARRAY[
  'profiles', 'subscriptions', 'marketplace_connections', 'affiliate_accounts',
  'integration_credentials', 'channel_connections', 'products', 'offers',
  'offer_score_weights', 'groups', 'sources', 'automations', 'publication_queue',
  'publications', 'offer_performance', 'group_performance', 'copy_experiments',
  'price_alerts', 'channel_health', 'retry_queue', 'user_preferences', 'user_brand',
  'admin_settings', 'affiliate_links', 'whatsapp_connections', 'whatsapp_groups',
  'whatsapp_publication_queue', 'whatsapp_settings'
];
BEGIN
  FOREACH t IN ARRAY tables_to_trigger LOOP
    BEGIN
      EXECUTE format(
        'CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()',
        t||'_updated_at', t
      );
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END LOOP;
END $$;

-- ============ 14. ROW LEVEL SECURITY (ESTRITA PRIVACIDADE) ============

-- RLS: Marketplaces (Leitura pública autenticada)
GRANT SELECT ON public.marketplaces TO authenticated;
GRANT ALL ON public.marketplaces TO service_role;
ALTER TABLE public.marketplaces ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "marketplaces_read" ON public.marketplaces FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- RLS: Categorias (Leitura própria + global)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "categories_read" ON public.categories FOR SELECT TO authenticated USING (user_id IS NULL OR user_id = auth.uid());
  CREATE POLICY "categories_insert" ON public.categories FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
  CREATE POLICY "categories_update" ON public.categories FOR UPDATE TO authenticated USING (user_id = auth.uid());
  CREATE POLICY "categories_delete" ON public.categories FOR DELETE TO authenticated USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- RLS: Profiles
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid() OR public.has_role(auth.uid(),'admin'));
  CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
  CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- RLS: User Roles
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "user_roles_select" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- RLS: Subscriptions
GRANT SELECT, UPDATE ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "subscriptions_select" ON public.subscriptions FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- RLS: Tabelas Privadas Simples (Chave única user_id)
DO $$
DECLARE t text;
DECLARE single_tables text[] := ARRAY['user_preferences','user_brand','whatsapp_settings'];
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

-- RLS: Tabelas Privadas de Fluxos (Acesso estrito do proprietário do user_id)
DO $$
DECLARE t text;
DECLARE owner_tables text[] := ARRAY[
  'marketplace_connections','affiliate_accounts','products','product_prices','offers',
  'offer_scores','offer_score_weights','coupons','groups','group_rules','sources','source_messages',
  'templates','automations','automation_rules','publication_queue','publications',
  'clicks','conversions','commissions','notifications','audit_logs',
  'offer_price_history','offer_performance','group_performance',
  'copy_experiments','price_alerts','tracking_links','automation_runs',
  'system_notifications','channel_health','retry_queue','affiliate_links',
  'marketplace_sync_logs','whatsapp_connections','whatsapp_groups',
  'whatsapp_publication_queue','whatsapp_logs'
];
BEGIN
  FOREACH t IN ARRAY owner_tables LOOP
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

-- RLS: Credenciais (Apenas service_role tem leitura/escrita para segredos)
GRANT ALL ON public.integration_credentials TO service_role;
ALTER TABLE public.integration_credentials ENABLE ROW LEVEL SECURITY;

-- RLS: Plan Limits & Admin Settings (Leitura pública autenticada)
GRANT SELECT ON public.plan_limits TO authenticated;
GRANT ALL ON public.plan_limits TO service_role;
ALTER TABLE public.plan_limits ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "plan_limits_read" ON public.plan_limits FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

GRANT SELECT ON public.admin_settings TO authenticated;
GRANT ALL ON public.admin_settings TO service_role;
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "admin_settings_read" ON public.admin_settings FOR SELECT TO authenticated USING (true);
  CREATE POLICY "admin_settings_write" ON public.admin_settings FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ 15. VIEWS ÚTEIS GLOBAIS ============
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
