-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('admin','user');
CREATE TYPE public.plan_tier AS ENUM ('free','basic','pro','business');
CREATE TYPE public.connection_status AS ENUM ('not_configured','pending','connected','error','disconnected');
CREATE TYPE public.offer_status AS ENUM ('new','approved','rejected','queued','published','archived');
CREATE TYPE public.queue_status AS ENUM ('pending','scheduled','processing','published','failed','cancelled');
CREATE TYPE public.channel_platform AS ENUM ('whatsapp','telegram','other');
CREATE TYPE public.source_type AS ENUM ('marketplace','channel','group','feed','api','external');

-- ============ HELPERS ============
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ============ PROFILES / ROLES / SUBSCRIPTIONS ============
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  company text,
  avatar_url text,
  phone text,
  demo_mode boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

CREATE TABLE public.subscriptions (
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

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ CATALOG (GLOBAL) ============
CREATE TABLE public.marketplaces (
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
  ('shein','SHEIN','#c1121f','SN',4);

CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.categories (name, slug) VALUES
  ('Casa','casa'),('Eletrônicos','eletronicos'),('Moda','moda'),('Beleza','beleza'),
  ('Cozinha','cozinha'),('Esporte','esporte'),('Infantil','infantil'),('Pet','pet');

-- ============ INTEGRATIONS ============
CREATE TABLE public.marketplace_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  marketplace text NOT NULL REFERENCES public.marketplaces(slug),
  status public.connection_status NOT NULL DEFAULT 'not_configured',
  last_sync_at timestamptz,
  last_error text,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, marketplace)
);

CREATE TABLE public.affiliate_accounts (
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

-- ============ PRODUCTS / OFFERS ============
CREATE TABLE public.products (
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

CREATE TABLE public.product_prices (
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

CREATE TABLE public.offers (
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
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX offers_user_created_idx ON public.offers (user_id, created_at DESC);
CREATE UNIQUE INDEX offers_user_fingerprint_idx ON public.offers (user_id, fingerprint) WHERE fingerprint IS NOT NULL;

CREATE TABLE public.offer_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  offer_id uuid NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
  score int NOT NULL,
  breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.offer_score_weights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  weights jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  marketplace text REFERENCES public.marketplaces(slug),
  code text NOT NULL,
  description text,
  discount_text text,
  valid_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============ CHANNELS ============
CREATE TABLE public.groups (
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
  template_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.group_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  field text NOT NULL,
  operator text NOT NULL,
  value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.sources (
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

CREATE TABLE public.source_messages (
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

-- ============ TEMPLATES / AUTOMATIONS ============
CREATE TABLE public.templates (
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

ALTER TABLE public.groups ADD CONSTRAINT groups_template_fk
  FOREIGN KEY (template_id) REFERENCES public.templates(id) ON DELETE SET NULL;

CREATE TABLE public.automations (
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
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.automation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  automation_id uuid NOT NULL REFERENCES public.automations(id) ON DELETE CASCADE,
  field text NOT NULL,
  operator text NOT NULL DEFAULT 'gte',
  value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============ QUEUE / PUBLICATIONS ============
CREATE TABLE public.publication_queue (
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

CREATE TABLE public.publications (
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

-- ============ METRICS ============
CREATE TABLE public.clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  offer_id uuid REFERENCES public.offers(id) ON DELETE SET NULL,
  publication_id uuid REFERENCES public.publications(id) ON DELETE SET NULL,
  marketplace text,
  group_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.conversions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  offer_id uuid REFERENCES public.offers(id) ON DELETE SET NULL,
  publication_id uuid REFERENCES public.publications(id) ON DELETE SET NULL,
  marketplace text,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'confirmed',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  conversion_id uuid REFERENCES public.conversions(id) ON DELETE CASCADE,
  offer_id uuid REFERENCES public.offers(id) ON DELETE SET NULL,
  marketplace text,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============ OPS ============
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'info',
  title text NOT NULL,
  body text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.audit_logs (
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

-- ============ RLS: global read tables ============
GRANT SELECT ON public.marketplaces TO authenticated;
GRANT ALL ON public.marketplaces TO service_role;
ALTER TABLE public.marketplaces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "marketplaces_read" ON public.marketplaces FOR SELECT TO authenticated USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories_read" ON public.categories FOR SELECT TO authenticated
  USING (user_id IS NULL OR user_id = auth.uid());
CREATE POLICY "categories_write" ON public.categories FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "categories_update" ON public.categories FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "categories_delete" ON public.categories FOR DELETE TO authenticated USING (user_id = auth.uid());

-- profiles
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- user_roles (read-only from client)
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_roles_select" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- subscriptions
GRANT SELECT, UPDATE ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subscriptions_select" ON public.subscriptions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- ============ RLS: owner tables ============
DO $$
DECLARE t text;
DECLARE owner_tables text[] := ARRAY[
  'marketplace_connections','affiliate_accounts','products','product_prices','offers',
  'offer_scores','offer_score_weights','coupons','groups','group_rules','sources','source_messages',
  'templates','automations','automation_rules','publication_queue','publications',
  'clicks','conversions','commissions','notifications','audit_logs'
];
BEGIN
  FOREACH t IN ARRAY owner_tables LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),''admin''))', t||'_select', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid())', t||'_insert', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())', t||'_update', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (user_id = auth.uid())', t||'_delete', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()', t||'_updated_at', t);
  END LOOP;
END $$;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER subscriptions_updated_at BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();