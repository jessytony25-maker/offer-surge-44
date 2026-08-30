import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Send,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Play,
  XCircle,
  RefreshCw,
  Eye,
  Sliders,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { WhatsAppNav } from "@/components/whatsapp/WhatsAppNav";
import { BRAND } from "@/lib/branding";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { WhatsAppQueueItemDto } from "@/lib/whatsapp/types";
import {
  listWhatsAppQueue,
  processWhatsAppQueueItem,
  cancelWhatsAppQueueItem,
} from "@/lib/whatsapp/whatsapp.functions";

export const Route = createFileRoute("/_authenticated/whatsapp/publicacoes")({
  head: () => ({
    meta: [
      { title: `Fila de Publicações WhatsApp — ${BRAND.name}` },
      { name: "description", content: "Gerencie a fila de disparos de ofertas para seus grupos do WhatsApp." },
      { property: "og:title", content: `Fila de Publicações WhatsApp — ${BRAND.name}` },
      { property: "og:description", content: "Gerencie a fila de disparos de ofertas." },
    ],
  }),
  component: WhatsAppPublicacoesPage,
});

const STATUS_MAP: Record<
  string,
  { label: string; badgeClass: string }
> = {
  pending: {
    label: "Pendente",
    badgeClass: "border-amber-500/30 bg-amber-500/10 text-amber-600",
  },
  scheduled: {
    label: "Agendado",
    badgeClass: "border-sky-500/30 bg-sky-500/10 text-sky-600",
  },
  processing: {
    label: "Enviando...",
    badgeClass: "border-purple-500/30 bg-purple-500/10 text-purple-600",
  },
  sent: {
    label: "Enviado",
    badgeClass: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600",
  },
  failed: {
    label: "Falhou",
    badgeClass: "border-destructive/30 bg-destructive/10 text-destructive",
  },
  cancelled: {
    label: "Cancelado",
    badgeClass: "border-border bg-muted text-muted-foreground",
  },
};

function WhatsAppPublicacoesPage() {
  const qc = useQueryClient();
  const [previewItem, setPreviewItem] = useState<WhatsAppQueueItemDto | null>(null);

  const fetchQueueFn = useServerFn(listWhatsAppQueue);
  const processItemFn = useServerFn(processWhatsAppQueueItem);
  const cancelItemFn = useServerFn(cancelWhatsAppQueueItem);

  const { data: queue = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["whatsapp-queue"],
    queryFn: () => fetchQueueFn(),
  });

  const processMutation = useMutation({
    mutationFn: async (queueItemId: string) => processItemFn({ data: { queueItemId } }),
    onSuccess: (res) => {
      if (res.ok) toast.success("Oferta publicada com sucesso no grupo!");
      else toast.error(res.reason || "Erro ao publicar no WhatsApp.");
      refetch();
      qc.invalidateQueries({ queryKey: ["whatsapp-queue"] });
      qc.invalidateQueries({ queryKey: ["whatsapp-logs"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao processar item."),
  });

  const cancelMutation = useMutation({
    mutationFn: async (queueItemId: string) => cancelItemFn({ data: { queueItemId } }),
    onSuccess: (res) => {
      toast.success(res.message);
      refetch();
      qc.invalidateQueries({ queryKey: ["whatsapp-queue"] });
    },
  });

  return (
    <AppShell
      title="Fila de Publicações WhatsApp"
      description="Acompanhe e controle os disparos agendados e enviados para os grupos"
      actions={
        <Button
          size="sm"
          variant="outline"
          onClick={() => refetch()}
          disabled={isLoading || isRefetching}
          className="gap-2 text-xs"
        >
          <RefreshCw className={`size-3.5 ${isRefetching ? "animate-spin" : ""}`} />
          Atualizar Fila
        </Button>
      }
    >
      <WhatsAppNav />

      {/* LISTAGEM DA FILA */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground py-12 text-center">Carregando fila...</p>
      ) : queue.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center space-y-3">
          <Send className="size-8 mx-auto text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Nenhuma publicação na fila</h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Assim que novas ofertas forem capturadas e validadas pelo motor de regras, elas serão enfileiradas automaticamente aqui.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 text-[11px] text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Grupo Destino</th>
                  <th className="px-4 py-3 font-medium">Mensagem / Oferta</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Agendamento</th>
                  <th className="px-4 py-3 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {queue.map((item) => {
                  const statusInfo = STATUS_MAP[item.status] || STATUS_MAP["pending"];
                  const isPending = item.status === "pending" || item.status === "scheduled" || item.status === "failed";

                  return (
                    <tr key={item.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-semibold text-foreground">
                        {item.group_name || "Grupo WhatsApp"}
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        <p className="truncate text-muted-foreground">{item.message}</p>
                        {item.last_error && (
                          <p className="text-[10px] text-destructive truncate">Motivo: {item.last_error}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={`text-[10px] uppercase font-semibold ${statusInfo?.badgeClass ?? ""}`}>
                          {statusInfo?.label ?? item.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground font-mono text-[11px]">
                        {new Date(item.scheduled_at).toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-7 text-muted-foreground"
                            onClick={() => setPreviewItem(item)}
                            title="Ver mensagem"
                          >
                            <Eye className="size-3.5" />
                          </Button>

                          {isPending && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs gap-1 text-emerald-600 border-emerald-500/30"
                                onClick={() => processMutation.mutate(item.id)}
                                disabled={processMutation.isPending}
                              >
                                <Play className="size-3" /> Disparar
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="size-7 text-destructive hover:bg-destructive/10"
                                onClick={() => cancelMutation.mutate(item.id)}
                                title="Cancelar envio"
                              >
                                <XCircle className="size-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL DE PRÉ-VISUALIZAÇÃO DA MENSAGEM */}
      <Dialog open={Boolean(previewItem)} onOpenChange={(open) => !open && setPreviewItem(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">Mensagem do WhatsApp</DialogTitle>
          </DialogHeader>
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/10 dark:bg-emerald-950/30 p-4 text-xs whitespace-pre-wrap font-sans text-foreground leading-relaxed">
            {previewItem?.message}
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
