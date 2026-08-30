-- =========================================================
-- MIGRATION: AFFILIATE LINK RESOLVER & AUDIT TRAIL
-- Tabela para persistência e rastreamento de links de afiliados
-- =========================================================

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

-- RLS
GRANT SELECT, INSERT, UPDATE, DELETE ON public.affiliate_links TO authenticated;
GRANT ALL ON public.affiliate_links TO service_role;
ALTER TABLE public.affiliate_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "affiliate_links_select" ON public.affiliate_links
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "affiliate_links_insert" ON public.affiliate_links
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "affiliate_links_update" ON public.affiliate_links
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "affiliate_links_delete" ON public.affiliate_links
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Trigger updated_at
CREATE TRIGGER affiliate_links_updated_at BEFORE UPDATE ON public.affiliate_links
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
