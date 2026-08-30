import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileText, RefreshCw, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { WhatsAppNav } from "@/components/whatsapp/WhatsAppNav";
import { BRAND } from "@/lib/branding";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { listWhatsAppLogs } from "@/lib/whatsapp/whatsapp.functions";

export const Route = createFileRoute("/_authenticated/whatsapp/logs")({
  head: () => ({
    meta: [
      { title: `Logs do WhatsApp — ${BRAND.name}` },
      { name: "description", content: "Histórico detalhado e auditoria de envios do WhatsApp." },
      { property: "og:title", content: `Logs do WhatsApp — ${BRAND.name}` },
      { property: "og:description", content: "Histórico detalhado de envios do WhatsApp." },
    ],
  }),
  component: WhatsAppLogsPage,
});

const LOG_STATUS_CONFIG: Record<
  string,
  { label: string; badgeClass: string }
> = {
  sent: {
    label: "Enviada",
    badgeClass: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600",
  },
  failed: {
    label: "Falhou",
    badgeClass: "border-destructive/30 bg-destructive/10 text-destructive",
  },
  skipped: {
    label: "Ignorada",
    badgeClass: "border-amber-500/30 bg-amber-500/10 text-amber-600",
  },
};

function WhatsAppLogsPage() {
  const fetchLogsFn = useServerFn(listWhatsAppLogs);

  const { data: logs = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["whatsapp-logs"],
    queryFn: () => fetchLogsFn(),
  });

  return (
    <AppShell
      title="Logs do WhatsApp"
      description="Auditoria de disparos, tentativas e motivos de validação das publicações"
      actions={
        <Button
          size="sm"
          variant="outline"
          onClick={() => refetch()}
          disabled={isLoading || isRefetching}
          className="gap-2 text-xs"
        >
          <RefreshCw className={`size-3.5 ${isRefetching ? "animate-spin" : ""}`} />
          Atualizar Logs
        </Button>
      }
    >
      <WhatsAppNav />

      {isLoading ? (
        <p className="text-sm text-muted-foreground py-12 text-center">Carregando logs...</p>
      ) : logs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center space-y-3">
          <FileText className="size-8 mx-auto text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Nenhum log registrado</h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Assim que as publicações forem processadas e validadas, os eventos de envio e eventuais bloqueios aparecerão aqui.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 text-[11px] text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Data / Hora</th>
                  <th className="px-4 py-3 font-medium">Grupo</th>
                  <th className="px-4 py-3 font-medium">Oferta</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Tentativas</th>
                  <th className="px-4 py-3 font-medium">Motivo / Detalhes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {logs.map((log) => {
                  const statusInfo = LOG_STATUS_CONFIG[log.status] || LOG_STATUS_CONFIG["skipped"];

                  return (
                    <tr key={log.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-4 py-3 font-semibold text-foreground">
                        {log.group_name}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">
                        {log.offer_title}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={`text-[10px] uppercase font-semibold ${statusInfo?.badgeClass ?? ""}`}>
                          {statusInfo?.label ?? log.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-center font-mono">
                        {log.attempt || 1}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground max-w-sm truncate">
                        {log.reason || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </AppShell>
  );
}
