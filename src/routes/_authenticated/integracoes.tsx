import { useMemo, useState, useEffect } from "react";
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
  AlertTriangle,
  History,
  Info,
} from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { BRAND } from "@/lib/branding";
import { MARKETPLACE_ADAPTERS, type MarketplaceSlug } from "@/integrations/marketplaces";
import { CHANNEL_CONNECTORS } from "@/integrations/channels";
import {
  listIntegrations,
  saveIntegration,
  disconnectIntegration,
  syncMarketplace,
  convertAndSaveAmazonLinkFn,
  diagnoseAmazonFn,
} from "@/lib/integrations.functions";
import { updateAutoSyncIntervalFn, getLatestSyncLogs } from "@/lib/sync/sync.functions";
import { exchangeMeliCodeFn, diagnoseMercadoLivre } from "@/lib/mercadolivre.functions";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TelegramQrConnector } from "@/components/telegram/TelegramQrConnector";

export const Route = createFileRoute("/_authenticated/integracoes")({
  head: () => ({
    meta: [
      { title: `Integration Health Center — ${BRAND.name}` },
      { name: "description", content: "Monitore a saúde e configure a sincronização automática das suas integrações." },
    ],
  }),
  component: Integracoes,
  errorComponent: ({ error, reset }) => (
    <AppShell title="Integrações">
      <div className="mx-auto max-w-lg space-y-4 py-16 text-center">
        <AlertTriangle className="mx-auto h-10 w-10 text-destructive" />
        <h1 className="text-xl font-semibold">Não foi possível carregar as integrações</h1>
        <p className="text-sm text-muted-foreground">{error.message}</p>
        <Button onClick={reset}>Tentar novamente</Button>
      </div>
    </AppShell>
  ),
});

type Kind = "marketplace" | "channel";

type Field = {
  key: string;
  label: string;
  secret?: boolean;
  required?: boolean;
  help?: string;
};

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
  autoSyncInterval?: string;
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
    badgeClass: "border-yellow-500/30 bg-yellow-500/10 text-yellow-600 font-semibold animate-pulse",
  },
  synced: {
    label: "SINCRONIZADO",
    badgeClass: "border-sky-500/30 bg-sky-500/10 text-sky-600 font-semibold",
  },
  error: {
    label: "ERRO",
    badgeClass: "border-destructive/30 bg-destructive/10 text-destructive font-semibold",
  },
};

const INTERVALS = [
  { value: "disabled", label: "Desativado" },
  { value: "15min", label: "A cada 15 minutos" },
  { value: "30min", label: "A cada 30 minutos" },
  { value: "1hour", label: "A cada 1 hora" },
  { value: "3hours", label: "A cada 3 horas" },
  { value: "daily", label: "Diariamente" },
];

function AmazonManualConverter() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [convertedUrl, setConvertedUrl] = useState("");
  
  const convertSaveFn = useServerFn(convertAndSaveAmazonLinkFn);

  const handleConvert = async () => {
    if (!url.trim()) {
      toast.warning("Cole uma URL da Amazon válida.");
      return;
    }
    setLoading(true);
    setConvertedUrl("");
    try {
      const res = await convertSaveFn({ data: { originalUrl: url.trim() } });
      if (res.ok) {
        setConvertedUrl(res.affiliateUrl);
        toast.success("Link convertido e salvo no catálogo!");
        setUrl("");
      } else {
        toast.error(res.error || "Erro ao converter link.");
      }
    } catch (e: any) {
      toast.error(e.message || "Erro de conexão com o servidor.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2 mt-2">
      <div className="flex items-center gap-1.5">
        <Link2 className="size-3.5 text-primary" />
        <span className="text-[11px] font-semibold text-foreground">Converter Link Amazon</span>
      </div>
      <p className="text-[10px] text-muted-foreground leading-tight">
        Cole a URL de um produto Amazon para convertê-la com sua Tag de Afiliado e salvá-la no catálogo.
      </p>
      <div className="flex gap-2">
        <Input
          placeholder="ex: https://www.amazon.com.br/dp/..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="h-8 text-xs font-mono bg-background"
        />
        <Button
          size="sm"
          onClick={handleConvert}
          disabled={loading || !url.trim()}
          className="h-8 text-xs shrink-0"
        >
          {loading ? "Convertendo..." : "Converter"}
        </Button>
      </div>
      {convertedUrl && (
        <div className="rounded bg-emerald-500/5 border border-emerald-500/10 p-2 text-[10px] space-y-1">
          <p className="font-semibold text-emerald-800">Link Convertido:</p>
          <p className="font-mono break-all text-emerald-700 select-all cursor-pointer">{convertedUrl}</p>
        </div>
      )}
    </div>
  );
}

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
  onChangeInterval,
  isUpdatingInterval,
  onDiagnose,
  isDiagnosing,
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
  onChangeInterval?: (interval: string) => void;
  isUpdatingInterval?: boolean;
  onDiagnose?: () => void;
  isDiagnosing?: boolean;
}) {
  const status = isSyncing ? "syncing" : row?.status ?? "not_configured";
  const isConnected = row?.status === "connected" || row?.status === "limited" || status === "synced";
  const missing = fields.filter((f) => f.required && !row?.filledKeys?.includes(f.key));
  const adapter = MARKETPLACE_ADAPTERS[slug as MarketplaceSlug];

  let displayLabel = "";
  let badgeStyleClass = "";

  if (slug === "amazon" && isConnected) {
    const hasKeys = row?.filledKeys?.includes("api_key") && row?.filledKeys?.includes("api_secret");
    if (hasKeys) {
      displayLabel = "Amazon conectada — Busca automática disponível";
      badgeStyleClass = "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 font-semibold";
    } else {
      displayLabel = "Amazon conectada — somente conversão manual de links";
      badgeStyleClass = "border-amber-500/30 bg-amber-500/10 text-amber-600 font-semibold";
    }
  } else {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG["not_configured"];
    displayLabel = cfg.label;
    badgeStyleClass = cfg.badgeClass;
  }

  return (
    <div className="flex flex-col justify-between rounded-xl border border-border bg-card p-5 space-y-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold text-foreground flex items-center gap-1.5">
              {name}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          </div>
          <Badge variant="outline" className={`text-[10px] px-2 py-0.5 uppercase ${badgeStyleClass}`}>
            {displayLabel}
          </Badge>
        </div>

        {/* Honest Capabilities Display */}
        {adapter && (
          <div className="rounded-lg bg-muted/30 p-2.5 space-y-1.5 text-xs text-muted-foreground border border-border">
            <span className="font-semibold text-foreground text-[11px] block">Capacidades e Limitações:</span>
            <div className="grid grid-cols-2 gap-1 text-[10px]">
              <div className="flex items-center gap-1">
                <span className={adapter.capabilities.autoSync.supported ? "text-emerald-600 font-semibold" : "text-amber-600"}>
                  {adapter.capabilities.autoSync.supported ? "● Sync Automático" : "○ Apenas Manual"}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <span className={adapter.capabilities.searchProducts.supported ? "text-emerald-600 font-semibold" : "text-amber-600"}>
                  {adapter.capabilities.searchProducts.supported ? "● Busca Catálogo" : "○ Sem Busca API"}
                </span>
              </div>
              <div className="flex items-center gap-1 col-span-2">
                <span className="text-emerald-600 font-semibold flex items-center gap-0.5">
                  <CheckCircle2 className="size-2.5" /> {adapter.capabilities.affiliateLinkGeneration.reason || "Links de Afiliados ativos"}
                </span>
              </div>
            </div>
            {adapter.capabilities.searchProducts.reason && (
              <p className="text-[9px] text-amber-700 bg-amber-500/5 px-1 py-0.5 rounded flex items-center gap-1 mt-1">
                <Info className="size-2.5 shrink-0" />
                {adapter.capabilities.searchProducts.reason}
              </p>
            )}
          </div>
        )}

        {/* Amazon Manual Link Converter Box */}
        {slug === "amazon" && isConnected && !(row?.filledKeys?.includes("api_key") && row?.filledKeys?.includes("api_secret")) && (
          <AmazonManualConverter />
        )}

        {/* Informações de sincronização e erros */}
        <div className="space-y-1.5 text-xs">
          {isConnected && row?.lastEventAt && (
            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Clock className="size-3 text-emerald-600" />
              Última Sincronização:{" "}
              <strong>{new Date(row.lastEventAt).toLocaleString("pt-BR")}</strong>
            </p>
          )}

          {row?.lastError && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-2.5 text-destructive flex items-start gap-1.5">
              <AlertCircle className="size-3.5 shrink-0 mt-0.5" />
              <p className="text-[11px] leading-tight font-mono">{row.lastError}</p>
            </div>
          )}

          {!isConnected && status !== "error" && missing.length > 0 && (
            <p className="text-[11px] text-muted-foreground">
              Campos obrigatórios ausentes: {missing.map((f) => f.label).join(", ")}.
            </p>
          )}

          {/* Frequência de Sincronização Automática */}
          {isConnected && kind === "marketplace" && onChangeInterval && (
            <div className="pt-2 flex items-center justify-between gap-2 border-t border-border">
              <Label className="text-[11px] text-muted-foreground font-medium">Sincronização Automática:</Label>
              <Select
                disabled={isUpdatingInterval || !adapter.capabilities.autoSync.supported}
                value={row?.autoSyncInterval || "disabled"}
                onValueChange={onChangeInterval}
              >
                <SelectTrigger className="h-7 text-[10px] w-36 font-semibold">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {INTERVALS.map((item) => (
                    <SelectItem key={item.value} value={item.value} className="text-[11px]">
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-border pt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={onConfigure}>
            <Settings className="size-3" />
            {status === "not_configured" ? "Configurar" : "Editar Credenciais"}
          </Button>

          {isConnected && kind === "marketplace" && onSync && (
            <Button
              size="sm"
              className="h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={onSync}
              disabled={isSyncing}
            >
              <RefreshCw className={`size-3 ${isSyncing ? "animate-spin" : ""}`} />
              {isSyncing ? "Sincronizando..." : "Sincronizar Agora"}
            </Button>
          )}
          {isConnected && (slug === "amazon" || slug === "mercadolivre") && onDiagnose && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs gap-1"
              onClick={onDiagnose}
              disabled={isDiagnosing}
            >
              Diagnosticar
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
              Docs <ExternalLink className="size-2.5" />
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
  const updateInterval = useServerFn(updateAutoSyncIntervalFn);
  const fetchLogs = useServerFn(getLatestSyncLogs);

  const { data, isLoading } = useQuery({
    queryKey: ["integrations"],
    queryFn: () => fetchList(),
    retry: 1,
    throwOnError: false,
  });

  const { data: syncLogs = [], refetch: refetchLogs } = useQuery({
    queryKey: ["sync_logs"],
    queryFn: () => fetchLogs(),
    retry: 1,
    throwOnError: false,
  });

  const [syncingSlug, setSyncingSlug] = useState<string | null>(null);
  const [updatingIntervalSlug, setUpdatingIntervalSlug] = useState<string | null>(null);

  // Estados do Diagnóstico Amazon
  const [amazonDiagnosis, setAmazonDiagnosis] = useState<any>(null);
  const [isDiagnosingAmazon, setIsDiagnosingAmazon] = useState(false);
  const [diagnoseModalOpen, setDiagnoseModalOpen] = useState(false);

  // Estados do Diagnóstico Mercado Livre
  const [meliDiagnosis, setMeliDiagnosis] = useState<any>(null);
  const [isDiagnosingMeli, setIsDiagnosingMeli] = useState(false);
  const [meliDiagnoseModalOpen, setMeliDiagnoseModalOpen] = useState(false);

  // Mutation para trocar o código OAuth do Mercado Livre
  const exchangeMeliCode = useServerFn(exchangeMeliCodeFn);
  const exchangeMutation = useMutation({
    mutationFn: (input: { code: string; redirectUri: string }) => exchangeMeliCode({ data: input }),
    onSuccess: (res) => {
      if (res.ok) {
        toast.success("Autenticação com o Mercado Livre concluída com sucesso!");
        // Limpa o parâmetro da URL
        const url = new URL(window.location.href);
        url.searchParams.delete("code");
        url.searchParams.delete("state");
        window.history.replaceState({}, "", url.toString());
        queryClient.invalidateQueries({ queryKey: ["integrations"] });
      } else {
        toast.error(res.error || "Falha ao autenticar com o Mercado Livre.");
      }
    },
    onError: () => toast.error("Falha ao comunicar com o servidor para autenticação."),
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      const searchParams = new URLSearchParams(window.location.search);
      const code = searchParams.get("code");
      if (code) {
        const redirectUri = `${window.location.origin}/integracoes`;
        exchangeMutation.mutate({ code, redirectUri });
      }
    }
  }, []);

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
        toast.success(
          `Sincronização Shopee concluída: ${res.total || 0} encontradas, ${res.imported || 0} importadas, ${res.updated || 0} atualizadas.`,
          { duration: 8000 }
        );
      } else {
        toast.error(res.message || "Erro na sincronização.");
      }
      queryClient.invalidateQueries({ queryKey: ["integrations"] });
      queryClient.invalidateQueries({ queryKey: ["offers"] });
      refetchLogs();
    },
    onError: (e) => {
      setSyncingSlug(null);
      toast.error(e instanceof Error ? e.message : "Erro ao sincronizar marketplace.");
    },
  });

  const updateIntervalMutation = useMutation({
    mutationFn: async (input: { marketplace: string; interval: string }) => {
      setUpdatingIntervalSlug(input.marketplace);
      return updateInterval({ data: input as any });
    },
    onSuccess: (res) => {
      setUpdatingIntervalSlug(null);
      toast.success(res.message);
      queryClient.invalidateQueries({ queryKey: ["integrations"] });
    },
    onError: () => {
      setUpdatingIntervalSlug(null);
      toast.error("Não foi possível atualizar a frequência de auto-sincronização.");
    },
  });

  const removeMutation = useMutation({
    mutationFn: (input: { kind: Kind; provider: string }) => remove({ data: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations"] });
      toast.success("Integração desconectada.");
    },
  });

  const runAmazonDiag = useServerFn(diagnoseAmazonFn);
  const handleAmazonDiagnose = async () => {
    setIsDiagnosingAmazon(true);
    setAmazonDiagnosis(null);
    setDiagnoseModalOpen(true);
    try {
      const res = await runAmazonDiag();
      setAmazonDiagnosis(res);
    } catch (e: any) {
      toast.error(e.message || "Erro ao executar diagnóstico da Amazon.");
    } finally {
      setIsDiagnosingAmazon(false);
    }
  };

  const runMeliDiag = useServerFn(diagnoseMercadoLivre);
  const handleMeliDiagnose = async () => {
    setIsDiagnosingMeli(true);
    setMeliDiagnosis(null);
    setMeliDiagnoseModalOpen(true);
    try {
      const res = await runMeliDiag();
      setMeliDiagnosis(res);
      queryClient.invalidateQueries({ queryKey: ["integrations"] });
    } catch (e: any) {
      toast.error(e.message || "Erro ao executar diagnóstico do Mercado Livre.");
    } finally {
      setIsDiagnosingMeli(false);
    }
  };

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
      title="Integration Health Center"
      description="Monitore a saúde, configure credenciais oficiais e automatize a sincronização"
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
              <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                <ShieldCheck className="size-5 text-emerald-600" />
                Saúde dos Adaptadores de Marketplace
              </h2>
              <p className="text-xs text-muted-foreground">
                Sincronize ofertas de canais oficiais e configure a recorrência do motor de busca.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
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
                onSync={a.capabilities.listOffers.supported ? () => syncMutation.mutate(a.slug) : undefined}
                isSyncing={syncingSlug === a.slug}
                onChangeInterval={
                  a.capabilities.autoSync.supported
                    ? (val) => updateIntervalMutation.mutate({ marketplace: a.slug, interval: val })
                    : undefined
                }
                isUpdatingInterval={updatingIntervalSlug === a.slug}
                onDiagnose={
                  a.slug === "amazon"
                    ? handleAmazonDiagnose
                    : a.slug === "mercadolivre"
                      ? handleMeliDiagnose
                      : undefined
                }
                isDiagnosing={
                  a.slug === "amazon"
                    ? isDiagnosingAmazon
                    : a.slug === "mercadolivre"
                      ? isDiagnosingMeli
                      : undefined
                }
              />
            ))}
          </div>
        </div>

        {/* SEÇÃO CANAIS */}
        <div className="space-y-3">
          <div className="border-b border-border pb-3">
            <h2 className="text-base font-semibold text-foreground">Canais de Transmissão</h2>
            <p className="text-xs text-muted-foreground">
              Configure as credenciais e destinos para envio automatizado de ofertas.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {/* CARD ATALHO WHATSAPP */}
            <div className="flex flex-col justify-between rounded-xl border border-border bg-card p-5 space-y-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-foreground">WhatsApp Multi-Device</h3>
                  <Badge variant="outline" className="text-[10px] uppercase border-emerald-500/30 bg-emerald-500/10 text-emerald-600 font-semibold">
                    Gateway Ativo
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Serviço de envio robusto com anti-flood inteligente, controle individual de grupos e liveness timer.
                </p>
              </div>
              <div className="border-t border-border pt-3">
                <Button size="sm" asChild className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white">
                  <a href="/whatsapp/conexoes">Conectar e Escanear QR Code</a>
                </Button>
              </div>
            </div>

            {/* TELEGRAM */}
            <IntegrationCard
              kind="channel"
              slug="telegram"
              name="Telegram Bot"
              description="Envio automatizado de ofertas reais para grupos e canais via Bot API."
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

        {/* LOGS DE EXECUÇÃO EM TEMPO REAL */}
        <div className="space-y-3 pt-4">
          <div className="border-b border-border pb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <History className="size-4 text-muted-foreground" />
              Histórico Recente de Sincronizações
            </h2>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5" onClick={() => refetchLogs()}>
              <RefreshCw className="size-3" /> Atualizar Logs
            </Button>
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            {syncLogs.length === 0 ? (
              <p className="text-xs text-muted-foreground p-6 text-center">Nenhum log de sincronização registrado.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 font-medium text-muted-foreground">
                      <th className="p-3">Adaptador</th>
                      <th className="p-3">Data/Hora</th>
                      <th className="p-3">Duração</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Lidas</th>
                      <th className="p-3 text-right text-emerald-600">Importadas</th>
                      <th className="p-3 text-right text-sky-600">Atualizadas</th>
                      <th className="p-3">Erros/Logs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {syncLogs.map((log) => {
                      const duration = log.finished_at
                        ? `${Math.round((new Date(log.finished_at).getTime() - new Date(log.started_at).getTime()) / 1000)}s`
                        : "em andamento";
                      return (
                        <tr key={log.id} className="border-b border-border hover:bg-muted/10 transition-colors">
                          <td className="p-3 font-semibold capitalize">{log.marketplace}</td>
                          <td className="p-3 text-muted-foreground">{new Date(log.started_at).toLocaleString("pt-BR")}</td>
                          <td className="p-3 text-muted-foreground font-mono">{duration}</td>
                          <td className="p-3">
                            <Badge
                              variant="outline"
                              className={`text-[9px] uppercase font-bold ${
                                log.status === "completed"
                                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
                                  : log.status === "partial_success"
                                    ? "border-sky-500/30 bg-sky-500/10 text-sky-700"
                                    : log.status === "running"
                                      ? "border-amber-500/30 bg-amber-500/10 text-amber-700 animate-pulse"
                                      : log.status === "limited"
                                        ? "border-amber-500/30 bg-amber-500/10 text-amber-600 font-semibold"
                                        : "border-destructive/30 bg-destructive/10 text-destructive"
                              }`}
                            >
                              {log.status === "completed"
                                ? "Sucesso"
                                : log.status === "partial_success"
                                  ? "Parcial"
                                  : log.status === "running"
                                    ? "Executando"
                                    : log.status === "limited"
                                      ? "Limitado"
                                      : "Falhou"}
                            </Badge>
                          </td>
                          <td className="p-3 text-right font-mono font-bold">{log.items_found}</td>
                          <td className="p-3 text-right font-mono font-bold text-emerald-600">{log.items_imported}</td>
                          <td className="p-3 text-right font-mono font-bold text-sky-600">{log.items_updated}</td>
                          <td className="p-3 text-muted-foreground truncate max-w-xs" title={log.last_error || ""}>
                            {log.last_error || "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
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

          {target?.provider === "mercadolivre" && (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 space-y-2 text-xs">
              <span className="font-semibold text-foreground flex items-center gap-1.5 text-amber-700">
                <AlertTriangle className="size-3.5" />
                Fluxo de Autenticação OAuth (Obrigatório)
              </span>
              <p className="text-[10px] text-muted-foreground leading-tight">
                Primeiro configure seu Client ID e Client Secret. Depois, registre a URL abaixo no console de desenvolvedor do Mercado Livre e clique em Autorizar.
              </p>
              <div className="text-[10px] bg-background p-1.5 rounded font-mono break-all select-all border border-border">
                Redirect URI: {typeof window !== "undefined" ? `${window.location.origin}/integracoes` : ""}
              </div>
              {values.client_id && (
                <Button
                  size="sm"
                  type="button"
                  className="w-full bg-amber-600 hover:bg-amber-700 text-white h-8 text-[11px]"
                  onClick={() => {
                    const redirectUri = `${window.location.origin}/integracoes`;
                    const authUrl = `https://auth.mercadolivre.com.br/authorization?response_type=code&client_id=${values.client_id.trim()}&redirect_uri=${encodeURIComponent(redirectUri)}`;
                    window.location.href = authUrl;
                  }}
                >
                  Autorizar no Mercado Livre
                </Button>
              )}
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

      {/* MODAL DE DIAGNÓSTICO DA AMAZON */}
      <Dialog open={diagnoseModalOpen} onOpenChange={setDiagnoseModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">Diagnóstico da Integração Amazon API</DialogTitle>
            <DialogDescription className="text-xs">
              Auditoria e mapeamento real das capacidades da conta de associados.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-3 text-xs">
            {isDiagnosingAmazon ? (
              <div className="py-6 text-center space-y-2">
                <RefreshCw className="size-6 text-primary animate-spin mx-auto" />
                <p className="text-muted-foreground">Executando testes no gateway de afiliados Amazon...</p>
              </div>
            ) : amazonDiagnosis ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">1. Tracking ID configurado</span>
                  <Badge variant="outline" className={`text-[10px] ${amazonDiagnosis.trackingIdConfigured.ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600" : "border-destructive/30 bg-destructive/10 text-destructive"}`}>
                    {amazonDiagnosis.trackingIdConfigured.ok ? "✓ " : "✗ "} {amazonDiagnosis.trackingIdConfigured.message}
                  </Badge>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">2. Credenciais de API</span>
                  <Badge variant="outline" className={`text-[10px] ${amazonDiagnosis.paApiCredentialsConfigured.ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600" : "border-muted-foreground bg-muted text-muted-foreground"}`}>
                    {amazonDiagnosis.paApiCredentialsConfigured.ok ? "✓ " : "⚪ "} {amazonDiagnosis.paApiCredentialsConfigured.message}
                  </Badge>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">3. PA-API disponível</span>
                  <Badge variant="outline" className={`text-[10px] ${amazonDiagnosis.paApiAvailable.ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600" : "border-amber-500/30 bg-amber-500/10 text-amber-600"}`}>
                    {amazonDiagnosis.paApiAvailable.ok ? "✓ " : "⚪ "} {amazonDiagnosis.paApiAvailable.message}
                  </Badge>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">4. Autenticação válida</span>
                  <Badge variant="outline" className={`text-[10px] ${amazonDiagnosis.authValid.ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600" : "border-amber-500/30 bg-amber-500/10 text-amber-600"}`}>
                    {amazonDiagnosis.authValid.ok ? "✓ " : "⚪ "} {amazonDiagnosis.authValid.message}
                  </Badge>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">5. Busca disponível</span>
                  <Badge variant="outline" className={`text-[10px] ${amazonDiagnosis.searchAvailable.ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600" : "border-amber-500/30 bg-amber-500/10 text-amber-600"}`}>
                    {amazonDiagnosis.searchAvailable.ok ? "✓ " : "⚪ "} {amazonDiagnosis.searchAvailable.message}
                  </Badge>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-muted-foreground">6. Geração de links</span>
                  <Badge variant="outline" className={`text-[10px] ${amazonDiagnosis.linkGenerationAvailable.ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600" : "border-destructive/30 bg-destructive/10 text-destructive"}`}>
                    {amazonDiagnosis.linkGenerationAvailable.ok ? "✓ " : "✗ "} {amazonDiagnosis.linkGenerationAvailable.message}
                  </Badge>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground italic">Erro ao carregar o relatório de auditoria.</p>
            )}
          </div>
          <DialogFooter>
            <Button size="sm" onClick={() => setDiagnoseModalOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL DE DIAGNÓSTICO DO MERCADO LIVRE */}
      <Dialog open={meliDiagnoseModalOpen} onOpenChange={setMeliDiagnoseModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">Diagnóstico da Integração Mercado Livre</DialogTitle>
            <DialogDescription className="text-xs">
              Mapeamento real de autenticação OAuth, API de Catálogo e afiliação.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-3 text-xs">
            {isDiagnosingMeli ? (
              <div className="py-6 text-center space-y-2">
                <RefreshCw className="size-6 text-primary animate-spin mx-auto" />
                <p className="text-muted-foreground">Executando diagnóstico em 10 etapas no Mercado Livre...</p>
              </div>
            ) : meliDiagnosis ? (
              <div className="space-y-2">
                <p className="text-[11px] font-bold text-foreground mb-2 bg-muted p-2 rounded">
                  Status Final: <span className="uppercase text-primary">{meliDiagnosis.connectionStatus}</span>
                  <br />
                  <span className="text-[10px] text-muted-foreground font-normal">{meliDiagnosis.summary}</span>
                </p>
                
                {meliDiagnosis.steps?.map((step: any) => (
                  <div key={step.id} className="flex items-start justify-between py-1.5 border-b border-border/40 gap-4">
                    <div className="space-y-0.5">
                      <span className="font-semibold text-foreground">TESTE {step.id}: {step.name}</span>
                      <p className="text-[10px] text-muted-foreground leading-tight">{step.detail}</p>
                      {step.endpoint && (
                        <p className="text-[9px] font-mono text-muted-foreground break-all">URL: {step.endpoint}</p>
                      )}
                    </div>
                    <Badge variant="outline" className={`text-[9px] shrink-0 ${step.status === "pass" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 font-semibold" : step.status === "fail" ? "border-destructive/30 bg-destructive/10 text-destructive font-semibold" : "border-muted bg-muted text-muted-foreground"}`}>
                      {step.status === "pass" ? "✓ PASSOU" : step.status === "fail" ? "✗ FALHOU" : "⏭️ PULADO"}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground italic">Erro ao carregar o relatório do Mercado Livre.</p>
            )}
          </div>
          <DialogFooter>
            <Button size="sm" onClick={() => setMeliDiagnoseModalOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
