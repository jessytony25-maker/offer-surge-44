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
  Plus,
  ShieldCheck,
  Zap,
  Radio,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { WhatsAppNav } from "@/components/whatsapp/WhatsAppNav";
import { DisconnectConfirmDialog } from "@/components/whatsapp/DisconnectConfirmDialog";
import { BRAND } from "@/lib/branding";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  getWhatsAppConnection,
  confirmWhatsAppScan,
  disconnectWhatsAppSession,
  syncWhatsAppGroups,
} from "@/lib/whatsapp/whatsapp.functions";

export const Route = createFileRoute("/_authenticated/whatsapp/conexoes")({
  head: () => ({
    meta: [
      { title: `Conexões WhatsApp — ${BRAND.name}` },
      { name: "description", content: "Conecte sua conta do WhatsApp via QR Code." },
      { property: "og:title", content: `Conexões WhatsApp — ${BRAND.name}` },
      { property: "og:description", content: "Conecte sua conta do WhatsApp via QR Code." },
    ],
  }),
  component: WhatsAppConexoesPage,
});

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; badgeClass: string }
> = {
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
  waiting_scan: {
    label: "Aguardando leitura",
    color: "text-sky-500",
    badgeClass: "border-sky-500/30 bg-sky-500/10 text-sky-600",
  },
  connecting: {
    label: "Conectando...",
    color: "text-purple-500",
    badgeClass: "border-purple-500/30 bg-purple-500/10 text-purple-600",
  },
  connected: {
    label: "Conectado",
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

  const fetchConn = useServerFn(getWhatsAppConnection);
  const confirmScanFn = useServerFn(confirmWhatsAppScan);
  const disconnectFn = useServerFn(disconnectWhatsAppSession);
  const syncGroupsFn = useServerFn(syncWhatsAppGroups);

  const { data: conn, isLoading, refetch } = useQuery({
    queryKey: ["whatsapp-connection"],
    queryFn: () => fetchConn(),
  });

  const confirmScanMutation = useMutation({
    mutationFn: async (connectionId: string) => confirmScanFn({ data: { connectionId } }),
    onSuccess: (res) => {
      toast.success("WhatsApp conectado com sucesso!");
      refetch();
      qc.invalidateQueries({ queryKey: ["whatsapp-groups"] });
      qc.invalidateQueries({ queryKey: ["whatsapp-metrics"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao confirmar leitura do QR Code."),
  });

  const disconnectMutation = useMutation({
    mutationFn: async (connectionId: string) => disconnectFn({ data: { connectionId } }),
    onSuccess: () => {
      toast.success("Sessão desconectada.");
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
  });

  const status = conn?.status || "disconnected";
  const statusInfo = STATUS_CONFIG[status] || STATUS_CONFIG.disconnected;
  const isConnected = status === "connected";

  return (
    <AppShell
      title="WhatsApp Connector"
      description="Gerencie a conexão da sua conta via QR Code e publique ofertas em seus grupos"
    >
      <WhatsAppNav />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* CARD PRINCIPAL DE CONEXÃO */}
        <div className="rounded-xl border border-border bg-card p-5 lg:col-span-2 space-y-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-border pb-4">
            <div>
              <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                <Smartphone className="size-4 text-emerald-600" />
                Conecte seu WhatsApp
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Escaneie o QR Code usando o WhatsApp no seu celular para conectar sua conta.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="outline" className={`text-xs font-semibold ${statusInfo.badgeClass}`}>
                {statusInfo.label}
              </Badge>
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

          {isConnected ? (
            /* TELA QUANDO CONECTADO */
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-6 text-center space-y-4">
              <div className="flex size-14 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-600 mx-auto">
                <CheckCircle2 className="size-8" />
              </div>

              <div className="space-y-1">
                <h3 className="text-base font-semibold text-foreground">
                  WhatsApp Conectado com Sucesso!
                </h3>
                <p className="text-xs text-muted-foreground font-mono">
                  {conn?.phone_number || "Número Vinculado"} • {conn?.display_name || "Sessão Ativa"}
                </p>
              </div>

              <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
                <Button
                  size="sm"
                  onClick={() => syncMutation.mutate()}
                  disabled={syncMutation.isPending}
                  className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <RefreshCw className={`size-3.5 ${syncMutation.isPending ? "animate-spin" : ""}`} />
                  {syncMutation.isPending ? "Sincronizando..." : "Sincronizar Grupos Agora"}
                </Button>
              </div>
            </div>
          ) : (
            /* TELA COM QR CODE */
            <div className="flex flex-col md:flex-row items-center gap-6 rounded-xl border border-border bg-muted/20 p-6">
              {/* Box do QR Code */}
              <div className="flex flex-col items-center gap-3 shrink-0">
                <div className="rounded-xl border-4 border-white bg-white p-3 shadow-md">
                  <QRCode
                    value={conn?.qr_code || `whatsapp-session-${conn?.session_identifier || "default"}`}
                    size={200}
                    level="M"
                    className="size-48"
                  />
                </div>
                <span className="text-[11px] font-mono text-muted-foreground flex items-center gap-1">
                  <Radio className="size-3 text-emerald-500 animate-pulse" />
                  Atualização em tempo real
                </span>
              </div>

              {/* Instruções */}
              <div className="space-y-4 flex-1">
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-foreground">
                    Como conectar:
                  </h4>
                  <ol className="space-y-2 text-xs text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 font-bold text-primary text-[10px]">1</span>
                      Abra o <strong>WhatsApp</strong> no seu celular
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 font-bold text-primary text-[10px]">2</span>
                      Toque em <strong>Configurações</strong> ou no menu de 3 pontos
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

                <div className="border-t border-border pt-3">
                  <Button
                    size="sm"
                    className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                    disabled={confirmScanMutation.isPending || !conn?.id}
                    onClick={() => conn && confirmScanMutation.mutate(conn.id)}
                  >
                    <CheckCircle2 className="size-3.5" />
                    {confirmScanMutation.isPending ? "Validando leitura..." : "Confirmar Leitura do QR Code"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* CARD LATERAL COM INFORMAÇÕES DE SEGURANÇA */}
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-emerald-600" />
              <h3 className="text-xs font-semibold text-foreground">Isolamento & Segurança</h3>
            </div>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Cada sessão possui armazenamento seguro e isolado por usuário. O módulo gerencia exclusivamente os canais e grupos em que seu número tem autorização para participar.
            </p>
            <div className="rounded-lg bg-muted/40 p-2.5 text-[11px] text-muted-foreground space-y-1">
              <p className="font-semibold text-foreground">Políticas ativas:</p>
              <ul className="list-disc list-inside space-y-0.5 text-[10px]">
                <li>Anti-flood com intervalo mínimo</li>
                <li>Janela de horário permitida</li>
                <li>Proteção contra duplicidade</li>
                <li>Pausa automática na desconexão</li>
              </ul>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4 space-y-2">
            <h4 className="text-xs font-semibold text-foreground">Detalhes da Sessão</h4>
            <dl className="space-y-1.5 text-[11px]">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Provedor:</dt>
                <dd className="font-semibold text-foreground">WhatsApp Web (Multi-Device)</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Status:</dt>
                <dd className="font-semibold text-foreground capitalize">{statusInfo.label}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Identificador:</dt>
                <dd className="font-mono text-[10px] text-muted-foreground truncate max-w-[120px]">
                  {conn?.session_identifier || "—"}
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
