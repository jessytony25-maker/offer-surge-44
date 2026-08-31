ALTER TABLE public.automations ADD COLUMN IF NOT EXISTS config jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.automations ADD COLUMN IF NOT EXISTS last_run_at timestamptz;

-- Bootstrap: garante que exista ao menos um administrador (primeiro usuário criado)
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin'::app_role
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.role = 'admin'::app_role)
ORDER BY u.created_at ASC
LIMIT 1
ON CONFLICT (user_id, role) DO NOTHING;