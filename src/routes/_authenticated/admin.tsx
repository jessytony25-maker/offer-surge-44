import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ShieldCheck,
  Users,
  Tag,
  Send,
  Zap,
  KeyRound,
  Wallet,
  RefreshCw,
  Save,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { BRAND } from "@/lib/branding";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  adminOverview,
  adminUsers,
  adminSetRole,
  adminSetPlan,
  adminSettings,
  adminSaveSetting,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: `Painel Administrativo — ${BRAND.name}` },
      {
        name: "description",
        content:
          "Painel de administração com usuários reais, planos, credenciais de integração e configurações globais.",
      },
      { property: "og:title", content: `Painel Administrativo — ${BRAND.name}` },
      {
        property: "og:description",
        content: "Gestão real de usuários, planos, credenciais e ajustes globais da plataforma.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

const PLANS = ["free", "basic", "pro", "business"] as const;

function brl(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function AdminPage() {
  const qc = useQueryClient();
  const overviewFn = useServerFn(adminOverview);
  const usersFn = useServerFn(adminUsers);
  const settingsFn = useServerFn(adminSettings);
  const setRoleFn = useServerFn(adminSetRole);
  const setPlanFn = useServerFn(adminSetPlan);
  const saveSettingFn = useServerFn(adminSaveSetting);

  const overview = useQuery({ queryKey: ["admin", "overview"], queryFn: () => overviewFn() });
  const users = useQuery({ queryKey: ["admin", "users"], queryFn: () => usersFn() });
  const settings = useQuery({ queryKey: ["admin", "settings"], queryFn: () => settingsFn() });

  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");

  const roleMutation = useMutation({
    mutationFn: (v: { userId: string; grant: boolean }) =>
      setRoleFn({ data: { userId: v.userId, role: "admin", grant: v.grant } }),
    onSuccess: () => {
      toast.success("Permissão atualizada.");
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const planMutation = useMutation({
    mutationFn: (v: { userId: string; plan: (typeof PLANS)[number] }) =>
      setPlanFn({ data: { userId: v.userId, plan: v.plan, status: "active" } }),
    onSuccess: () => {
      toast.success("Plano atualizado.");
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const settingMutation = useMutation({
    mutationFn: (v: { key: string; value: string }) => saveSettingFn({ data: v }),
    onSuccess: () => {
      toast.success("Configuração salva.");
      setNewKey("");
      setNewValue("");
      qc.invalidateQueries({ queryKey: ["admin", "settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const denied =
    overview.isError && /administrador/i.test((overview.error as Error)?.message ?? "");

  if (denied) {
    return (
      <AppShell title="Painel Administrativo" description="Acesso restrito">
        <div className="mx-auto max-w-md rounded-xl border border-border bg-card p-8 text-center">
          <Lock className="mx-auto size-8 text-muted-foreground" />
          <h2 className="mt-3 text-base font-semibold">Acesso restrito</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Somente administradores da plataforma podem abrir este painel.
          </p>
        </div>
      </AppShell>
    );
  }

  const m = overview.data?.metrics;
  const cards = [
    { label: "Usuários", value: m?.users ?? 0, icon: Users },
    { label: "Ofertas", value: m?.offers ?? 0, icon: Tag },
    { label: "Publicações", value: m?.publications ?? 0, icon: Send },
    { label: "Automações", value: m?.automations ?? 0, icon: Zap },
    { label: "Credenciais", value: m?.credentials ?? 0, icon: KeyRound },
    { label: "Comissões", value: brl(m?.revenue ?? 0), icon: Wallet },
  ];

  return (
    <AppShell
      title="Painel Administrativo"
      description="Dados reais da plataforma: usuários, planos, credenciais e configurações globais"
      actions={
        <Button
          size="sm"
          variant="outline"
          className="gap-2"
          onClick={() => {
            overview.refetch();
            users.refetch();
            settings.refetch();
          }}
        >
          <RefreshCw className="size-4" /> Atualizar
        </Button>
      }
    >
      <div className="mb-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Icon className="size-4" />
                <span className="text-xs">{c.label}</span>
              </div>
              <p className="mt-2 text-lg font-semibold text-foreground">{c.value}</p>
            </div>
          );
        })}
      </div>

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">Usuários & Planos</TabsTrigger>
          <TabsTrigger value="credentials">Credenciais</TabsTrigger>
          <TabsTrigger value="settings">Configurações</TabsTrigger>
          <TabsTrigger value="logs">Auditoria</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-4 space-y-3">
          {(users.data ?? []).map((u) => {
            const isAdmin = u.roles.includes("admin");
            return (
              <div key={u.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {u.full_name || u.email}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Último acesso:{" "}
                      {u.last_sign_in_at
                        ? new Date(u.last_sign_in_at).toLocaleString("pt-BR")
                        : "nunca"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Badge variant={u.confirmed ? "secondary" : "outline"}>
                      {u.confirmed ? "E-mail confirmado" : "Pendente"}
                    </Badge>
                    <Select
                      value={u.plan}
                      onValueChange={(plan) =>
                        planMutation.mutate({
                          userId: u.id,
                          plan: plan as (typeof PLANS)[number],
                        })
                      }
                    >
                      <SelectTrigger className="h-8 w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PLANS.map((p) => (
                          <SelectItem key={p} value={p}>
                            {p}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex items-center gap-2">
                      <ShieldCheck
                        className={`size-4 ${isAdmin ? "text-primary" : "text-muted-foreground"}`}
                      />
                      <Switch
                        checked={isAdmin}
                        onCheckedChange={(grant) => roleMutation.mutate({ userId: u.id, grant })}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          {users.isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando usuários…</p>
          ) : null}
        </TabsContent>

        <TabsContent value="credentials" className="mt-4 space-y-3">
          <p className="text-xs text-muted-foreground">
            Credenciais reais salvas pelos usuários. Os valores são exibidos mascarados — nem o
            painel administrativo expõe segredos completos.
          </p>
          {(users.data ?? []).flatMap((u) =>
            u.credentials.map((c) => (
              <div
                key={`${u.id}-${c.kind}-${c.provider}`}
                className="rounded-xl border border-border bg-card p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold capitalize text-foreground">
                      {c.provider} <span className="text-muted-foreground">({c.kind})</span>
                    </p>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                  </div>
                  <Badge variant="secondary">
                    {new Date(c.updated_at).toLocaleString("pt-BR")}
                  </Badge>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {c.fields.map((f) => (
                    <div
                      key={f.key}
                      className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/40 px-3 py-2"
                    >
                      <span className="text-xs text-muted-foreground">{f.key}</span>
                      <code className="text-xs text-foreground">{f.masked}</code>
                    </div>
                  ))}
                </div>
              </div>
            )),
          )}
        </TabsContent>

        <TabsContent value="settings" className="mt-4 space-y-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="text-sm font-semibold">Nova configuração global</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
              <div>
                <Label className="text-xs">Chave</Label>
                <Input value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="max_daily_publications" />
              </div>
              <div>
                <Label className="text-xs">Valor (texto ou JSON)</Label>
                <Input value={newValue} onChange={(e) => setNewValue(e.target.value)} placeholder="100" />
              </div>
              <Button
                className="gap-2"
                disabled={!newKey.trim() || settingMutation.isPending}
                onClick={() => settingMutation.mutate({ key: newKey.trim(), value: newValue })}
              >
                <Save className="size-4" /> Salvar
              </Button>
            </div>
          </div>

          {(settings.data ?? []).map((s) => (
            <div key={s.id} className="rounded-xl border border-border bg-card p-4">
              <p className="text-sm font-semibold text-foreground">{s.key}</p>
              <pre className="mt-2 overflow-x-auto rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                {JSON.stringify(s.value, null, 2)}
              </pre>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="logs" className="mt-4 space-y-2">
          {(overview.data?.logs ?? []).map((l) => (
            <div
              key={l.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card px-4 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm text-foreground">
                  <span className="font-medium">{l.channel}</span> · {l.action}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {new Date(l.created_at).toLocaleString("pt-BR")}
                </p>
              </div>
              <Badge variant={l.level === "error" ? "destructive" : "secondary"}>{l.level}</Badge>
            </div>
          ))}
          {(overview.data?.logs ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum evento registrado ainda.</p>
          ) : null}
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
