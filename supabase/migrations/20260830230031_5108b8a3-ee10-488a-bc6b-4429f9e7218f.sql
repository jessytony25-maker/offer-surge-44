-- Batch 1: affiliate_links, marketplace_sync_logs, tracking_links
BEGIN;

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
  status text NOT NULL DEFAULT 'running',
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

CREATE TABLE IF NOT EXISTS public.tracking_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  affiliate_link_id uuid REFERENCES public.affiliate_links(id) ON DELETE SET NULL,
  offer_id uuid REFERENCES public.offers(id) ON DELETE SET NULL,
  publication_id uuid REFERENCES public.publications(id) ON DELETE SET NULL,
  group_id uuid REFERENCES public.groups(id) ON DELETE SET NULL,
  short_code text NOT NULL UNIQUE,
  destination_url text NOT NULL,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  clicks int NOT NULL DEFAULT 0,
  unique_clicks int NOT NULL DEFAULT 0,
  conversions int NOT NULL DEFAULT 0,
  revenue numeric(12,2) NOT NULL DEFAULT 0,
  commission numeric(12,2) NOT NULL DEFAULT 0,
  last_clicked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tracking_user ON public.tracking_links(user_id);
CREATE INDEX IF NOT EXISTS idx_tracking_short_code ON public.tracking_links(short_code);
CREATE INDEX IF NOT EXISTS idx_tracking_offer ON public.tracking_links(offer_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.affiliate_links TO authenticated;
GRANT ALL ON public.affiliate_links TO service_role;
ALTER TABLE public.affiliate_links ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "affiliate_links_select" ON public.affiliate_links FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
  CREATE POLICY "affiliate_links_insert" ON public.affiliate_links FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
  CREATE POLICY "affiliate_links_update" ON public.affiliate_links FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  CREATE POLICY "affiliate_links_delete" ON public.affiliate_links FOR DELETE TO authenticated USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketplace_sync_logs TO authenticated;
GRANT ALL ON public.marketplace_sync_logs TO service_role;
ALTER TABLE public.marketplace_sync_logs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "marketplace_sync_logs_select" ON public.marketplace_sync_logs FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
  CREATE POLICY "marketplace_sync_logs_insert" ON public.marketplace_sync_logs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
  CREATE POLICY "marketplace_sync_logs_update" ON public.marketplace_sync_logs FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  CREATE POLICY "marketplace_sync_logs_delete" ON public.marketplace_sync_logs FOR DELETE TO authenticated USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tracking_links TO authenticated;
GRANT ALL ON public.tracking_links TO service_role;
ALTER TABLE public.tracking_links ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "tracking_links_select" ON public.tracking_links FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
  CREATE POLICY "tracking_links_insert" ON public.tracking_links FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
  CREATE POLICY "tracking_links_update" ON public.tracking_links FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  CREATE POLICY "tracking_links_delete" ON public.tracking_links FOR DELETE TO authenticated USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$
DECLARE t text;
DECLARE tables_to_trigger text[] := ARRAY['affiliate_links','marketplace_sync_logs','tracking_links'];
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
