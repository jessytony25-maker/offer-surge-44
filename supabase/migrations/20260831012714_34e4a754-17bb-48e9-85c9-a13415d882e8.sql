ALTER TABLE public.marketplace_sync_logs ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DELETE FROM public.products a USING public.products b
WHERE a.ctid < b.ctid AND a.user_id = b.user_id AND a.marketplace = b.marketplace AND a.external_id = b.external_id;

DELETE FROM public.offers a USING public.offers b
WHERE a.ctid < b.ctid AND a.user_id = b.user_id AND a.marketplace = b.marketplace AND a.title = b.title;

ALTER TABLE public.products ADD CONSTRAINT products_user_marketplace_external_key UNIQUE (user_id, marketplace, external_id);
ALTER TABLE public.offers ADD CONSTRAINT offers_user_marketplace_title_key UNIQUE (user_id, marketplace, title);

UPDATE public.marketplace_sync_logs
SET status = 'error', finished_at = now(), last_error = COALESCE(last_error, 'Sincronização interrompida (registro antigo).')
WHERE status = 'running';