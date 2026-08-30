import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  ExternalLink,
  Settings,
  ShieldCheck,
  Link2,
} from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { BRAND } from "@/lib/branding";
import { MARKETPLACE_ADAPTERS } from "@/integrations/marketplaces";
import { CHANNEL_CONNECTORS } from "@/integrations/channels";
import {
  listIntegrations,
  saveIntegration,
  disconnectIntegration,
  syncMarketplace,
} from "@/lib/integrations.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TelegramQrConnector } from "@/components/telegram/TelegramQrConnector";

export const Route = createFileRoute("/_authenticated/integracoes")({
  head: () => ({
    meta: [
      { title: `Integrações & Marketplaces — ${BRAND.name}` },
      { name: "description", content: "Conecte marketplaces e canais oficiais de publicação." },
      { property: "og:title", content: `Integrações & Marketplaces — ${BRAND.name}` },
      { property: "og:description", content: "Conecte marketplaces e canais oficiais." },
    ],
  }),
  component: Integracoes,
});

type Kind = "marketplace" | "channel";

type Field = {
  key: string;
  label: string;
  secret?: boolean;
  required?: boolean;
  help?: string;
};

/** Extrai matt_word / matt_tool de um link de afiliado do Mercado Livre. */
function extractMeliCredentials(raw: string): { matt_word?: string; matt_tool?: string } | null {
  try {
    const url = new URL(raw.trim());
    const word = url.searchParams.get("matt_word") ?? undefined;
    const tool = url.searchParams.get("matt_tool") ?? undefined;
    if (!word && !tool) return null;
    return { ...(word ? { matt_word: word } : {}), ...(tool ? { matt_tool: tool } : {}) };
  } catch {
    return null;
  }
}

type StatusRow = {
  provider: string;
  status: string;
  lastError: string | null;
  lastEventAt: string | null;
  filledKeys: string[];
};

const STATUS_CONFIG: Record<
  string,
  { label: string; badgeClass: string }
> = {
  not_configured: {
    label: "NÃO CONFIGURADO",
    badgeClass: "border-border bg-muted text-muted-foreground",
  },
  pending: {
    label: "EM VALIDAÇÃO",
    badgeClass: "border-amber-500/30 bg-amber-500/10 text-amber-600 font-semibold",
  },
  connected: {
    label: "CONECTADO",
    badgeClass: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 font-semibold",
  },
  syncing: {
    label: "SINCRONIZANDO",
    badgeClass: "border-sky-500/30 bg-sky-500/10 text-sky-600 font-semibold",
  },
  error: {
    label: "ERRO",
    badgeClass: "border-destructive/30 bg-destructive/10 text-destructive font-semibold",
  },
};

function IntegrationCard({
  kind,
  slug,
  name,
  description,
  row,
  fields,
  docsUrl,
  onConfigure,
  onDisconnect,
  onSync,
  isSyncing,
}: {
  kind: Kind;
  slug: string;
  name: string;
  description: string;
  row?: StatusRow | undefined;
  fields: Field[];
  docsUrl?: string | undefined;
  onConfigure: () => void;
  onDisconnect: () => void;
  onSync?: () => void;
  isSyncing?: boolean;
}) {
  const status = isSyncing ? "syncing" : row?.status ?? "not_configured";
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.not_configured;
  const isConnected = row?.status === "connected";
  const missing = fields.filter((f) => f.required && !row?.filledKeys?.includes(f.key));

  return (
    <div className="flex flex-col justify-between rounded-xl border border-border bg-card p-5 space-y-4 shadow-sm">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold text-foreground flex items-center gap-1.5">
              {name}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          </div>
          <Badge variant="outline" className={`text-[10px] px-2 py-0.5 uppercase ${cfg.badgeClass}`}>
            {cfg.label}
          </Badge>
        </div>

        {/* Informações de sincronização e erros */}
        <div className="space-y-1.5 text-xs">
          {isConnected && row?.lastEventAt && (
            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Clock className="size-3 text-emerald-600" />
              Última sincronização:{" "}
              <strong>{new Date(row.lastEventAt).toLocaleString("pt-BR")}</strong>
            </p>
          )}

          {row?.lastError && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-2.5 text-destructive flex items-start gap-1.5">
              <AlertCircle className="size-3.5 shrink-0 mt-0.5" />
              <p className="text-[11px] leading-tight">{row.lastError}</p>
            </div>
          )}

          {!isConnected && status !== "error" && missing.length > 0 && (
            <p className="text-[11px] text-muted-foreground">
              Campos obrigatórios: {missing.map((f) => f.label).join(", ")}.
            </p>
          )}
        </div>
      </div>

      <div className="border-t border-border pt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={onConfigure}>
            <Settings className="size-3" />
            {status === "not_configured" ? "Configurar" : "Editar"}
          </Button>

          {isConnected && kind === "marketplace" && onSync && (
            <Button
              size="sm"
              className="h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={onSync}
              disabled={isSyncing}
            >
              <RefreshCw className={`size-3 ${isSyncing ? "animate-spin" : ""}`} />
              {isSyncing ? "Sincronizando..." : "Sincronizar"}
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {docsUrl && (
            <a
              href={docsUrl}
              target="_blank"
              rel="noreferrer"
              className="text-[11px] text-primary hover:underline flex items-center gap-0.5"
            >
              Documentação <ExternalLink className="size-2.5" />
            </a>
          )}

          {status !== "not_configured" && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs text-destructive hover:bg-destructive/10"
              onClick={onDisconnect}
            >
              Desconectar
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Integracoes() {
  const queryClient = useQueryClient();
  const fetchList = useServerFn(listIntegrations);
  const save = useServerFn(saveIntegration);
  const remove = useServerFn(disconnectIntegration);
  const syncFn = useServerFn(syncMarketplace);

  const { data, isLoading } = useQuery({
    queryKey: ["integrations"],
    queryFn: () => fetchList(),
  });

  const [syncingSlug, setSyncingSlug] = useState<string | null>(null);

  const [target, setTarget] = useState<{
    kind: Kind;
    provider: string;
    name: string;
    fields: Field[];
    filled: string[];
  } | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [meliLink, setMeliLink] = useState("");

  const saveMutation = useMutation({
    mutationFn: (input: { kind: Kind; provider: string; credentials: Record<string, string> }) =>
      save({ data: input }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["integrations"] });
      setTarget(null);
      if (result.status === "connected") toast.success(result.message);
      else if (result.status === "error") toast.error(result.message);
      else toast.info(result.message);
    },
    onError: () => toast.error("Falha ao salvar as credenciais."),
  });

  const syncMutation = useMutation({
    mutationFn: async (marketplace: string) => {
      setSyncingSlug(marketplace);
      return syncFn({ data: { marketplace: marketplace as any } });
    },
    onSuccess: (res) => {
      setSyncingSlug(null);
      if (res.ok) {
        toast.success(res.message || "Ofertas sincronizadas com sucesso!");
      } else {
        toast.error(res.message || "Erro durante a sincronização.");
      }
      queryClient.invalidateQueries({ queryKey: ["integrations"] });
      queryClient.invalidateQueries({ queryKey: ["offers"] });
    },
    onError: (e) => {
      setSyncingSlug(null);
      toast.error(e instanceof Error ? e.message : "Erro ao sincronizar marketplace.");
    },
  });

  const removeMutation = useMutation({
    mutationFn: (input: { kind: Kind; provider: string }) => remove({ data: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations"] });
      toast.success("Integração desconectada.");
    },
  });

  const marketplaceRows = useMemo(
    () => new Map((data?.marketplaces ?? []).map((r) => [r.provider, r as StatusRow])),
    [data],
  );
  const channelRows = useMemo(
    () => new Map((data?.channels ?? []).map((r) => [r.provider, r as StatusRow])),
    [data],
  );

  const openDialog = (kind: Kind, provider: string, name: string, fields: Field[]) => {
    const row = kind === "marketplace" ? marketplaceRows.get(provider) : channelRows.get(provider);
    setValues({});
    setMeliLink("");
    setTarget({ kind, provider, name, fields, filled: row?.filledKeys ?? [] });
  };

  return (
    <AppShell
      title="Integrações & Marketplaces"
      description="Conexão oficial com Shopee, Mercado Livre, Amazon, SHEIN e Canais de Transmissão"
      actions={
        <TelegramQrConnector
          onGroupsUpdated={() => queryClient.invalidateQueries({ queryKey: ["integrations"] })}
        />
      }
    >
      <div className="space-y-8">
        {/* SEÇÃO MARKETPLACES */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">Marketplaces & Afiliados</h2>
              <p className="text-xs text-muted-foreground">
                Conecte os programas de afiliados para sincronizar ofertas reais e gerar links comissionados.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-2">
            {Object.values(MARKETPLACE_ADAPTERS).map((a) => (
              <IntegrationCard
                key={a.slug}
                kind="marketplace"
                slug={a.slug}
                name={a.name}
                description={a.program}
                docsUrl={a.docsUrl}
                fields={a.credentialFields}
                row={marketplaceRows.get(a.slug)}
                onConfigure={() => openDialog("marketplace", a.slug, a.name, a.credentialFields)}
                onDisconnect={() =>
                  removeMutation.mutate({ kind: "marketplace", provider: a.slug })
                }
                onSync={() => syncMutation.mutate(a.slug)}
                isSyncing={syncingSlug === a.slug}
              />
            ))}
          </div>
        </div>

        {/* SEÇÃO CANAIS */}
        <div className="space-y-3">
          <div className="border-b border-border pb-3">
            <h2 className="text-base font-semibold text-foreground">Canais de Publicação</h2>
            <p className="text-xs text-muted-foreground">
              Destinos onde suas ofertas serão enviadas de forma automatizada.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {/* CARD ATALHO WHATSAPP */}
            <div className="flex flex-col justify-between rounded-xl border border-border bg-card p-5 space-y-4 shadow-sm">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-foreground">WhatsApp Connector</h3>
                  <Badge variant="outline" className="text-[10px] uppercase border-emerald-500/30 bg-emerald-500/10 text-emerald-600 font-semibold">
                    Multi-Device / Gateway
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Conexão real via QR Code com controle individual por grupo, anti-flood e fila de disparos.
                </p>
              </div>
              <div className="border-t border-border pt-3">
                <Button size="sm" asChild className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white">
                  <a href="/whatsapp/conexoes">Gerenciar Conexão WhatsApp</a>
                </Button>
              </div>
            </div>

            {/* TELEGRAM */}
            <IntegrationCard
              kind="channel"
              slug="telegram"
              name="Telegram Bot"
              description="Publicação em canais e grupos públicos/privados via Bot API oficial."
              docsUrl="https://core.telegram.org/bots"
              fields={CHANNEL_CONNECTORS["telegram"]?.credentialFields ?? []}
              row={channelRows.get("telegram")}
              onConfigure={() =>
                openDialog(
                  "channel",
                  "telegram",
                  "Telegram",
                  CHANNEL_CONNECTORS["telegram"]?.credentialFields ?? [],
                )
              }
              onDisconnect={() =>
                removeMutation.mutate({ kind: "channel", provider: "telegram" })
              }
            />
          </div>
        </div>
      </div>

      {/* MODAL DE CONFIGURAÇÃO DE CREDENCIAIS */}
      <Dialog open={Boolean(target)} onOpenChange={(open) => !open && setTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Configurar {target?.name}</DialogTitle>
            <DialogDescription className="text-xs">
              Informe as credenciais oficiais. Os dados ficam salvos de forma segura no servidor.
            </DialogDescription>
          </DialogHeader>

          {/* PARSER AUTOMÁTICO DE LINK DO MERCADO LIVRE */}
          {target?.provider === "mercadolivre" && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2 text-xs">
              <Label htmlFor="meli-helper" className="text-xs font-semibold flex items-center gap-1.5 text-primary">
                <Link2 className="size-3.5" />
                Preenchimento Automático via Link de Afiliado
              </Label>
              <Input
                id="meli-helper"
                placeholder="Cole um link gerado no Mercado Livre Afiliados..."
                value={meliLink}
                onChange={(e) => {
                  const val = e.target.value;
                  setMeliLink(val);
                  const extracted = extractMeliCredentials(val);
                  if (extracted) {
                    setValues((prev) => ({
                      ...prev,
                      ...(extracted.matt_word ? { affiliate_id: extracted.matt_word } : {}),
                      ...(extracted.matt_tool ? { tracking_id: extracted.matt_tool } : {}),
                    }));
                    toast.success("matt_word e matt_tool extraídos com sucesso!");
                  }
                }}
                className="h-8 text-xs font-mono"
              />
              <p className="text-[10px] text-muted-foreground">
                Cole qualquer link de produto que você gerou no painel de afiliados do Mercado Livre.
              </p>
            </div>
          )}

          <div className="space-y-3 py-2">
            {target?.fields.map((f) => (
              <div key={f.key} className="space-y-1">
                <Label htmlFor={f.key} className="text-xs font-medium">
                  {f.label} {f.required && <span className="text-destructive">*</span>}
                </Label>
                <Input
                  id={f.key}
                  type={f.secret ? "password" : "text"}
                  placeholder={
                    target.filled.includes(f.key) ? "•••••••••••••• (já configurado)" : ""
                  }
                  value={values[f.key] ?? ""}
                  onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                  className="h-8 text-xs font-mono"
                />
                {f.help && <p className="text-[10px] text-muted-foreground">{f.help}</p>}
              </div>
            ))}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button size="sm" variant="outline" onClick={() => setTarget(null)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => {
                if (!target) return;
                saveMutation.mutate({
                  kind: target.kind,
                  provider: target.provider,
                  credentials: values,
                });
              }}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? "Validando e Salvando..." : "Salvar e Validar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
