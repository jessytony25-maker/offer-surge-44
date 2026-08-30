BEGIN;

ALTER TABLE public.tracking_links ADD COLUMN IF NOT EXISTS marketplace text;
CREATE INDEX IF NOT EXISTS idx_tracking_marketplace ON public.tracking_links(marketplace);

ALTER TABLE public.marketplace_connections ADD COLUMN IF NOT EXISTS auto_sync_interval text DEFAULT 'disabled';
CREATE INDEX IF NOT EXISTS idx_mkt_conn_interval ON public.marketplace_connections(user_id, auto_sync_interval);

COMMIT;
