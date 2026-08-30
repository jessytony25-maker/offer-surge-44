-- Batch 2: analytics tables
BEGIN;

CREATE TABLE IF NOT EXISTS public.offer_price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  offer_id uuid REFERENCES public.offers(id) ON DELETE CASCADE,
  marketplace text NOT NULL,
  price numeric(12,2) NOT NULL,
  promo_price numeric(12,2),
  discount_pct numeric(5,2),
  captured_at timestamptz NOT NULL DEFAULT now(),
  source text
);

CREATE INDEX IF NOT EXISTS idx_price_history_product ON public.offer_price_history(product_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_price_history_offer ON public.offer_price_history(offer_id, captured_at DESC);

CREATE TABLE IF NOT EXISTS public.offer_performance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  offer_id uuid NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
  date date NOT NULL,
  impressions int NOT NULL DEFAULT 0,
  clicks int NOT NULL DEFAULT 0,
  conversions int NOT NULL DEFAULT 0,
  revenue numeric(12,2) NOT NULL DEFAULT 0,
  commission numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (offer_id, date)
);

CREATE INDEX IF NOT EXISTS idx_offer_perf_date ON public.offer_performance(offer_id, date DESC);

CREATE TABLE IF NOT EXISTS public.group_performance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  date date NOT NULL,
  publications_count int NOT NULL DEFAULT 0,
  clicks int NOT NULL DEFAULT 0,
  sales int NOT NULL DEFAULT 0,
  commission numeric(12,2) NOT NULL DEFAULT 0,
  revenue numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, date)
);

CREATE INDEX IF NOT EXISTS idx_group_perf_date ON public.group_performance(group_id, date DESC);

CREATE TABLE IF NOT EXISTS public.copy_experiments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  offer_id uuid REFERENCES public.offers(id) ON DELETE CASCADE,
  group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE,
  variant_name text NOT NULL,
  copy_text text NOT NULL,
  impressions int NOT NULL DEFAULT 0,
  clicks int NOT NULL DEFAULT 0,
  conversions int NOT NULL DEFAULT 0,
  is_winner boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_copy_exp_offer ON public.copy_experiments(offer_id);
CREATE INDEX IF NOT EXISTS idx_copy_exp_group ON public.copy_experiments(group_id);

CREATE TABLE IF NOT EXISTS public.price_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  offer_id uuid REFERENCES public.offers(id) ON DELETE CASCADE,
  marketplace text NOT NULL,
  target_price numeric(12,2),
  target_discount_pct numeric(5,2),
  status text NOT NULL DEFAULT 'active',
  triggered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_price_alerts_user ON public.price_alerts(user_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.offer_price_history TO authenticated;
GRANT ALL ON public.offer_price_history TO service_role;
ALTER TABLE public.offer_price_history ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "offer_price_history_select" ON public.offer_price_history FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
  CREATE POLICY "offer_price_history_insert" ON public.offer_price_history FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
  CREATE POLICY "offer_price_history_update" ON public.offer_price_history FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  CREATE POLICY "offer_price_history_delete" ON public.offer_price_history FOR DELETE TO authenticated USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.offer_performance TO authenticated;
GRANT ALL ON public.offer_performance TO service_role;
ALTER TABLE public.offer_performance ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "offer_performance_select" ON public.offer_performance FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
  CREATE POLICY "offer_performance_insert" ON public.offer_performance FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
  CREATE POLICY "offer_performance_update" ON public.offer_performance FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  CREATE POLICY "offer_performance_delete" ON public.offer_performance FOR DELETE TO authenticated USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_performance TO authenticated;
GRANT ALL ON public.group_performance TO service_role;
ALTER TABLE public.group_performance ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "group_performance_select" ON public.group_performance FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
  CREATE POLICY "group_performance_insert" ON public.group_performance FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
  CREATE POLICY "group_performance_update" ON public.group_performance FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  CREATE POLICY "group_performance_delete" ON public.group_performance FOR DELETE TO authenticated USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.copy_experiments TO authenticated;
GRANT ALL ON public.copy_experiments TO service_role;
ALTER TABLE public.copy_experiments ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "copy_experiments_select" ON public.copy_experiments FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
  CREATE POLICY "copy_experiments_insert" ON public.copy_experiments FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
  CREATE POLICY "copy_experiments_update" ON public.copy_experiments FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  CREATE POLICY "copy_experiments_delete" ON public.copy_experiments FOR DELETE TO authenticated USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.price_alerts TO authenticated;
GRANT ALL ON public.price_alerts TO service_role;
ALTER TABLE public.price_alerts ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "price_alerts_select" ON public.price_alerts FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
  CREATE POLICY "price_alerts_insert" ON public.price_alerts FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
  CREATE POLICY "price_alerts_update" ON public.price_alerts FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  CREATE POLICY "price_alerts_delete" ON public.price_alerts FOR DELETE TO authenticated USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$
DECLARE t text;
DECLARE tables_to_trigger text[] := ARRAY['offer_performance','group_performance','copy_experiments','price_alerts'];
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

COMMIT;
