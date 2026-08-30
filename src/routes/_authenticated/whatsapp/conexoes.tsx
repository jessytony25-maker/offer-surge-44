import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import QRCode from "react-qr-code";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  QrCode,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  LogOut,
  Settings,
  ShieldCheck,
  Zap,
  Radio,
  Server,
  KeyRound,
  ExternalLink,
  HelpCircle,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { WhatsAppNav } from "@/components/whatsapp/WhatsAppNav";
import { DisconnectConfirmDialog } from "@/components/whatsapp/DisconnectConfirmDialog";
import { BRAND } from "@/lib/branding";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getWhatsAppConnection,
  checkWhatsAppStatus,
  saveWhatsAppGatewayConfig,
  refreshWhatsAppQrCode,
  disconnectWhatsAppSession,
  syncWhatsAppGroups,
} from "@/lib/whatsapp/whatsapp.functions";

export const Route = createFileRoute("/_authenticated/whatsapp/conexoes")({
  head: () => ({
    meta: [
      { title: `Conexões WhatsApp — ${BRAND.name}` },
      { name: "description", content: "Conecte sua conta do WhatsApp via QR Code real." },
      { property: "og:title", content: `Conexões WhatsApp — ${BRAND.name}` },
      { property: "og:description", content: "Conecte sua conta do WhatsApp via QR Code real." },
    ],
  }),
  component: WhatsAppConexoesPage,
});

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; badgeClass: string }
> = {
  not_configured: {
    label: "Gateway Não Configurado",
    color: "text-amber-500",
    badgeClass: "border-amber-500/30 bg-amber-500/10 text-amber-600",
  },
  waiting_qr: {
    label: "Aguardando QR Code",
    color: "text-amber-500",
    badgeClass: "border-amber-500/30 bg-amber-500/10 text-amber-600",
  },
  qr_ready: {
    label: "QR Code disponível",
    color: "text-sky-500",
    badgeClass: "border-sky-500/30 bg-sky-500/10 text-sky-600",
  },
  connecting: {
    label: "Conectando...",
    color: "text-purple-500",
    badgeClass: "border-purple-500/30 bg-purple-500/10 text-purple-600",
  },
  connected: {
    label: "🟢 Conectado",
    color: "text-emerald-500",
    badgeClass: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600",
  },
  disconnected: {
    label: "Desconectado",
    color: "text-muted-foreground",
    badgeClass: "border-border bg-muted text-muted-foreground",
  },
  error: {
    label: "Erro na conexão",
    color: "text-destructive",
    badgeClass: "border-destructive/30 bg-destructive/10 text-destructive",
  },
};

function WhatsAppConexoesPage() {
  const qc = useQueryClient();
  const [disconnectModalOpen, setDisconnectModalOpen] = useState(false);
  const [showConfigForm, setShowConfigForm] = useState(false);

  // Campos do formulário de gateway
  const [apiUrl, setApiUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [instanceName, setInstanceName] = useState("");

  const fetchConn = useServerFn(getWhatsAppConnection);
  const checkStatusFn = useServerFn(checkWhatsAppStatus);
  const saveConfigFn = useServerFn(saveWhatsAppGatewayConfig);
  const refreshQrFn = useServerFn(refreshWhatsAppQrCode);
  const disconnectFn = useServerFn(disconnectWhatsAppSession);
  const syncGroupsFn = useServerFn(syncWhatsAppGroups);

  const { data: conn, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["whatsapp-connection"],
    queryFn: () => fetchConn(),
  });

  // Preenche dados ao carregar
  useEffect(() => {
    if (conn) {
      if (conn.api_url) setApiUrl(conn.api_url);
      if (conn.api_key) setApiKey(conn.api_key);
      if (conn.instance_name) setInstanceName(conn.instance_name);
      if (conn.status === "not_configured") {
        setShowConfigForm(true);
      }
    }
  }, [conn]);

  // Polling automático apenas enquanto aguarda QR code ou está conectando
  useEffect(() => {
    if (!conn) return;
    if (conn.status === "qr_ready" || conn.status === "connecting") {
      const interval = setInterval(async () => {
        try {
          const updated = await checkStatusFn({ data: { connectionId: conn.id } });
          if (updated.status === "connected") {
            toast.success("WhatsApp conectado com sucesso!");
            refetch();
            qc.invalidateQueries({ queryKey: ["whatsapp-groups"] });
            qc.invalidateQueries({ queryKey: ["whatsapp-metrics"] });
          }
        } catch {}
      }, 4000);

      return () => clearInterval(interval);
    }
    return;
  }, [conn?.status, conn?.id]);

  const saveConfigMutation = useMutation({
    mutationFn: async () => {
      if (!apiUrl.trim()) {
        throw new Error("A URL da API / Servidor do WhatsApp é obrigatória.");
      }
      return saveConfigFn({
        data: {
          apiUrl: apiUrl.trim(),
          apiKey: apiKey.trim() || undefined,
          instanceName: instanceName.trim() || undefined,
        },
      });
    },
    onSuccess: (res) => {
      toast.success("Configurações do Gateway salvas!");
      setShowConfigForm(false);
      refetch();
      qc.invalidateQueries({ queryKey: ["whatsapp-connection"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao salvar configurações do gateway."),
  });

  const checkStatusMutation = useMutation({
    mutationFn: async () => checkStatusFn({ data: { connectionId: conn?.id } }),
    onSuccess: (res) => {
      if (res.status === "connected") {
        toast.success("WhatsApp conectado com sucesso!");
      } else if (res.status === "qr_ready") {
        toast.info("Aguardando leitura do QR Code no WhatsApp.");
      } else if (res.status === "not_configured") {
        toast.warning("Gateway de WhatsApp ainda não configurado.");
      } else {
        toast.info(`Status atual: ${STATUS_CONFIG[res.status]?.label || res.status}`);
      }
      refetch();
      qc.invalidateQueries({ queryKey: ["whatsapp-groups"] });
      qc.invalidateQueries({ queryKey: ["whatsapp-metrics"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao verificar status da conexão."),
  });

  const refreshQrMutation = useMutation({
    mutationFn: async () => refreshQrFn(),
    onSuccess: () => {
      toast.success("QR Code atualizado com o servidor.");
      refetch();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao atualizar QR Code."),
  });

  const disconnectMutation = useMutation({
    mutationFn: async (connectionId: string) => disconnectFn({ data: { connectionId } }),
    onSuccess: () => {
      toast.success("Sessão desconectada do servidor.");
      setDisconnectModalOpen(false);
      refetch();
      qc.invalidateQueries({ queryKey: ["whatsapp-connection"] });
      qc.invalidateQueries({ queryKey: ["whatsapp-groups"] });
      qc.invalidateQueries({ queryKey: ["whatsapp-metrics"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao desconectar."),
  });

  const syncMutation = useMutation({
    mutationFn: async () => syncGroupsFn(),
    onSuccess: (res) => {
      toast.success(res.message);
      qc.invalidateQueries({ queryKey: ["whatsapp-groups"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao sincronizar grupos reais."),
  });

  const status = conn?.status || "not_configured";
  const statusInfo = STATUS_CONFIG[status] || STATUS_CONFIG["not_configured"];
  const isConnected = status === "connected";
  const isQrReady = status === "qr_ready" && Boolean(conn?.qr_code);
  const isNotConfigured = status === "not_configured";

  return (
    <AppShell
      title="WhatsApp Connector"
      description="Conecte seu WhatsApp através de um Gateway real (Evolution API, WAHA, Z-API) com QR Code oficial"
    >
      <WhatsAppNav />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* CARD PRINCIPAL */}
        <div className="rounded-xl border border-border bg-card p-5 lg:col-span-2 space-y-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-border pb-4">
            <div>
              <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                <Smartphone className="size-4 text-emerald-600" />
                Conexão com WhatsApp
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Pareamento real com o WhatsApp Web via Gateway Multi-Device.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="outline" className={`text-xs font-semibold ${statusInfo?.badgeClass ?? ""}`}>
                {statusInfo?.label ?? status}
              </Badge>

              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1"
                onClick={() => setShowConfigForm(!showConfigForm)}
              >
                <Settings className="size-3" />
                {showConfigForm ? "Fechar Configuração" : "Configurar Gateway"}
              </Button>

              {isConnected && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs text-destructive hover:bg-destructive/10 border-destructive/30"
                  onClick={() => setDisconnectModalOpen(true)}
                >
                  <LogOut className="size-3 mr-1" />
                  Desconectar
                </Button>
              )}
            </div>
          </div>

          {/* FORMULÁRIO DE CONFIGURAÇÃO DO GATEWAY (QUANDO ABERTO OU NÃO CONFIGURADO) */}
          {showConfigForm && (
            <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <div className="flex items-center gap-2">
                  <Server className="size-4 text-emerald-600" />
                  <h3 className="text-xs font-semibold text-foreground">
                    Configuração do Servidor / Gateway do WhatsApp
                  </h3>
                </div>
                <Badge variant="secondary" className="text-[10px]">Evolution API / WAHA / Z-API</Badge>
              </div>

              <div className="space-y-3 text-xs">
                <div className="space-y-1">
                  <Label htmlFor="gw-url" className="text-xs font-semibold">
                    URL da API / Servidor do WhatsApp <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="gw-url"
                    placeholder="ex: https://whatsapp.meuservidor.com ou http://localhost:8080"
                    value={apiUrl}
                    onChange={(e) => setApiUrl(e.target.value)}
                    className="h-8 text-xs font-mono"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Endereço base do seu servidor Evolution API, WAHA ou Z-API.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="gw-key" className="text-xs font-semibold">
                      Chave de API / Token Global (API Key)
                    </Label>
                    <Input
                      id="gw-key"
                      type="password"
                      placeholder="ex: B6D711FCDE4D4FD5936544120E713976"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      className="h-8 text-xs font-mono"
                    />
                    <p className="text-[10px] text-muted-foreground">Chave de autenticação (header apikey).</p>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="gw-inst" className="text-xs font-semibold">
                      Nome da Instância
                    </Label>
                    <Input
                      id="gw-inst"
                      placeholder="ex: oferta-hub (opcional)"
                      value={instanceName}
                      onChange={(e) => setInstanceName(e.target.value)}
                      className="h-8 text-xs font-mono"
                    />
                    <p className="text-[10px] text-muted-foreground">Deixe vazio para gerar automaticamente.</p>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 text-xs"
                    onClick={() => saveConfigMutation.mutate()}
                    disabled={saveConfigMutation.isPending}
                  >
                    <CheckCircle2 className="size-3.5" />
                    {saveConfigMutation.isPending ? "Conectando ao Gateway..." : "Salvar e Conectar"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* 1. TELA QUANDO NÃO CONFIGURADO */}
          {isNotConfigured && !showConfigForm && (
            <div className="rounded-xl border border-dashed border-amber-500/40 bg-amber-500/5 p-6 text-center space-y-4">
              <div className="flex size-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 mx-auto">
                <Server className="size-6" />
              </div>
              <div className="space-y-1 max-w-md mx-auto">
                <h3 className="text-sm font-semibold text-foreground">
                  Gateway do WhatsApp Não Configurado
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Para gerar o QR Code real e sincronizar seus grupos com o WhatsApp, informe a URL e a chave de API do seu servidor de WhatsApp (Evolution API, WAHA ou Z-API).
                </p>
              </div>
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 text-xs"
                onClick={() => setShowConfigForm(true)}
              >
                <Settings className="size-3.5" />
                Configurar Gateway Agora
              </Button>
            </div>
          )}

          {/* 2. TELA QUANDO CONECTADO */}
          {isConnected && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-6 text-center space-y-4">
              <div className="flex size-14 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-600 mx-auto">
                <CheckCircle2 className="size-8" />
              </div>

              <div className="space-y-1">
                <h3 className="text-base font-semibold text-foreground">
                  WhatsApp Conectado com Sucesso!
                </h3>
                <p className="text-xs text-muted-foreground font-mono">
                  {conn?.phone_number ? `Telefone: +${conn.phone_number}` : "Sessão Aberta"} • {conn?.display_name || "WhatsApp"}
                </p>
                {conn?.connected_at && (
                  <p className="text-[11px] text-muted-foreground">
                    Conectado em: {new Date(conn.connected_at).toLocaleString("pt-BR")}
                  </p>
                )}
              </div>

              <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
                <Button
                  size="sm"
                  onClick={() => syncMutation.mutate()}
                  disabled={syncMutation.isPending}
                  className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                >
                  <RefreshCw className={`size-3.5 ${syncMutation.isPending ? "animate-spin" : ""}`} />
                  {syncMutation.isPending ? "Sincronizando..." : "↻ Sincronizar Grupos Reais"}
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => checkStatusMutation.mutate()}
                  disabled={checkStatusMutation.isPending}
                  className="gap-1.5 text-xs"
                >
                  <RefreshCw className={`size-3.5 ${checkStatusMutation.isPending ? "animate-spin" : ""}`} />
                  Verificar Conexão
                </Button>
              </div>
            </div>
          )}

          {/* 3. TELA COM QR CODE REAL RECEBIDO DO SERVIDOR */}
          {!isConnected && !isNotConfigured && (
            <div className="flex flex-col md:flex-row items-center gap-6 rounded-xl border border-border bg-muted/20 p-6">
              {/* Box do QR Code Real */}
              <div className="flex flex-col items-center gap-3 shrink-0">
                <div className="rounded-xl border-4 border-white bg-white p-3 shadow-md min-size-[200px] flex items-center justify-center">
                  {isQrReady && conn?.qr_code ? (
                    conn.qr_code.startsWith("data:image/") || conn.qr_code.startsWith("http") ? (
                      <img
                        src={conn.qr_code}
                        alt="QR Code do WhatsApp"
                        className="size-48 object-contain"
                      />
                    ) : (
                      <QRCode
                        value={conn.qr_code}
                        size={192}
                        level="M"
                        className="size-48"
                      />
                    )
                  ) : (
                    <div className="flex flex-col items-center justify-center size-48 text-center p-4">
                      <RefreshCw className="size-8 text-muted-foreground animate-spin mb-2" />
                      <span className="text-[11px] text-muted-foreground">
                        Solicitando QR Code real ao servidor...
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono text-muted-foreground flex items-center gap-1">
                    <Radio className="size-3 text-emerald-500 animate-pulse" />
                    Monitorando leitura em tempo real
                  </span>
                </div>
              </div>

              {/* Instruções de Pareamento */}
              <div className="space-y-4 flex-1">
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-foreground">
                    Como conectar sua conta:
                  </h4>
                  <ol className="space-y-2 text-xs text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 font-bold text-primary text-[10px]">1</span>
                      Abra o <strong>WhatsApp</strong> no seu smartphone
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 font-bold text-primary text-[10px]">2</span>
                      Toque em <strong>Configurações</strong> (iOS) ou nos 3 pontinhos (Android)
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 font-bold text-primary text-[10px]">3</span>
                      Selecione <strong>Aparelhos conectados</strong>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 font-bold text-primary text-[10px]">4</span>
                      Toque em <strong>Conectar um aparelho</strong> e aponte para o QR Code ao lado
                    </li>
                  </ol>
                </div>

                <div className="border-t border-border pt-3 flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-xs"
                    onClick={() => checkStatusMutation.mutate()}
                    disabled={checkStatusMutation.isPending}
                  >
                    <RefreshCw className={`size-3.5 ${checkStatusMutation.isPending ? "animate-spin" : ""}`} />
                    {checkStatusMutation.isPending ? "Consultando..." : "Verificar Conexão Agora"}
                  </Button>

                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1.5 text-xs text-muted-foreground"
                    onClick={() => refreshQrMutation.mutate()}
                    disabled={refreshQrMutation.isPending}
                  >
                    <RefreshCw className={`size-3.5 ${refreshQrMutation.isPending ? "animate-spin" : ""}`} />
                    Atualizar QR Code
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* CARD LATERAL COM INFORMAÇÕES DE INTEGRAÇÃO */}
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-emerald-600" />
              <h3 className="text-xs font-semibold text-foreground">Conexão Segura & Oficial</h3>
            </div>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              O conector utiliza comunicação direta com o gateway de WhatsApp configurado pelo usuário. Não há simulação de dados nem mock de grupos.
            </p>
            <div className="rounded-lg bg-muted/40 p-2.5 text-[11px] text-muted-foreground space-y-1">
              <p className="font-semibold text-foreground">Garantias do Conector:</p>
              <ul className="list-disc list-inside space-y-0.5 text-[10px]">
                <li>QR Code gerado exclusivamente pelo servidor</li>
                <li>Status confirmado via endpoint do gateway</li>
                <li>Importação apenas de grupos reais existentes</li>
                <li>Envio real de mensagens com ID de entrega</li>
              </ul>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4 space-y-2">
            <h4 className="text-xs font-semibold text-foreground">Detalhes da Instância</h4>
            <dl className="space-y-1.5 text-[11px]">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Status:</dt>
                <dd className="font-semibold text-foreground capitalize">{statusInfo?.label ?? status}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Instância:</dt>
                <dd className="font-mono text-[10px] text-muted-foreground truncate max-w-[120px]">
                  {conn?.instance_name || conn?.session_identifier || "—"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Gateway URL:</dt>
                <dd className="font-mono text-[10px] text-muted-foreground truncate max-w-[140px]">
                  {conn?.api_url || process.env["WHATSAPP_GATEWAY_URL"] || "Não configurado"}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      {/* MODAL DE DESCONEXÃO SEGURA */}
      <DisconnectConfirmDialog
        open={disconnectModalOpen}
        onOpenChange={setDisconnectModalOpen}
        onConfirm={() => conn?.id && disconnectMutation.mutate(conn.id)}
        isLoading={disconnectMutation.isPending}
      />
    </AppShell>
  );
}
