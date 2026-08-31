ALTER TABLE public.products ADD COLUMN IF NOT EXISTS price numeric;

ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS external_product_id text;
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS review_count integer;
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS affiliate_status text DEFAULT 'pending';
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS source text;
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS synced_at timestamptz;

ALTER TABLE public.offer_price_history ADD COLUMN IF NOT EXISTS original_price numeric;
ALTER TABLE public.offer_price_history ADD COLUMN IF NOT EXISTS coupon text;
ALTER TABLE public.offer_price_history ADD COLUMN IF NOT EXISTS free_shipping boolean DEFAULT false;
ALTER TABLE public.offer_price_history ADD COLUMN IF NOT EXISTS available boolean DEFAULT true;