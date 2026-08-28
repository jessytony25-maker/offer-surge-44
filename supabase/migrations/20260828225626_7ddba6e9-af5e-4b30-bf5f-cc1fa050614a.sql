CREATE TABLE public.integration_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('marketplace','channel')),
  provider text not null,
  credentials jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, kind, provider)
);

-- Sem acesso pela Data API: apenas funções de servidor privilegiadas podem ler/escrever.
GRANT ALL ON public.integration_credentials TO service_role;
ALTER TABLE public.integration_credentials ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.channel_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform public.channel_platform not null,
  status public.connection_status not null default 'not_configured',
  last_error text,
  last_test_at timestamptz,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, platform)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.channel_connections TO authenticated;
GRANT ALL ON public.channel_connections TO service_role;
ALTER TABLE public.channel_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own channel connections"
ON public.channel_connections FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_integration_credentials_updated_at
BEFORE UPDATE ON public.integration_credentials
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_channel_connections_updated_at
BEFORE UPDATE ON public.channel_connections
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();