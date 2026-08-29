import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Check, Copy, ListChecks, Share2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { supabase } from "@/integrations/supabase/client";
import { BRAND } from "@/lib/branding";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { copyText, shareText, whatsappShareUrl } from "@/lib/whatsapp-share";
import { dateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/fila")({
  head: () => ({
    meta: [
      { title: `Fila de publicação — ${BRAND.name}` },
      {
        name: "description",
        content: "Fila de publicação com modo copiar e publicar para grupos de WhatsApp.",
      },
      { property: "og:title", content: `Fila de publicação — ${BRAND.name}` },
      {
        property: "og:description",
        content: "Mensagens prontas para publicar nos seus grupos.",
      },
    ],
  }),
  component: Fila,
});

type QueueRow = {
  id: string;
  content: string | null;
  status: string;
  scheduled_at: string;
  group_id: string | null;
  groups: { name: string; platform: string; identifier: string | null } | null;
};

function Fila() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Record<string, string>>({});

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["publication_queue"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("publication_queue")
        .select("id, content, status, scheduled_at, group_id, groups(name, platform, identifier)")
        .order("scheduled_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as QueueRow[];
    },
  });

  const markPublished = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("publication_queue")
        .update({ status: "published" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Marcada como publicada");
      qc.invalidateQueries({ queryKey: ["publication_queue"] });
    },
    onError: () => toast.error("Não foi possível atualizar"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("publication_queue").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Item removido da fila");
      qc.invalidateQueries({ queryKey: ["publication_queue"] });
    },
    onError: () => toast.error("Não foi possível remover"),
  });

  const saveContent = useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) => {
      const { error } = await supabase
        .from("publication_queue")
        .update({ content })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Mensagem atualizada");
      qc.invalidateQueries({ queryKey: ["publication_queue"] });
    },
    onError: () => toast.error("Não foi possível salvar"),
  });

  const pending = items.filter((i) => i.status !== "published" && i.status !== "cancelled");
  const done = items.filter((i) => i.status === "published");

  return (
    <AppShell
      title="Fila de publicação"
      description="Telegram publica automático · WhatsApp em modo copiar e publicar"
    >
      <div className="rounded-xl border border-border bg-card p-4 text-xs leading-relaxed text-muted-foreground">
        <strong className="text-foreground">Como funciona o WhatsApp:</strong> a API oficial da
        Meta não envia para grupos nem lista os seus grupos. Então a plataforma monta a mensagem
        pronta (com link de afiliado) e você publica com um toque: toque em{" "}
        <span className="text-foreground">Copiar</span> ou{" "}
        <span className="text-foreground">Abrir WhatsApp</span>, escolha o grupo e envie. No
        Telegram, com o bot admin no grupo, a publicação é automática.
      </div>

      {isLoading ? (
        <p className="mt-4 text-sm text-muted-foreground">Carregando...</p>
      ) : items.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            icon={<ListChecks className="size-6" />}
            title="Fila vazia"
            description="Envie uma oferta para a fila pelo botão Publicar na tela de Ofertas."
          />
        </div>
      ) : (
        <div className="mt-4 space-y-6">
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">
              Aguardando publicação ({pending.length})
            </h2>
            {pending.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nada pendente.</p>
            ) : (
              pending.map((item) => {
                const text = editing[item.id] ?? item.content ?? "";
                const isWhats = item.groups?.platform !== "telegram";
                return (
                  <article
                    key={item.id}
                    className="rounded-xl border border-border bg-card p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">
                          {item.groups?.name ?? "Sem grupo"}
                        </h3>
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                          {item.groups?.platform ?? "—"} · {dateTime(item.scheduled_at)}
                        </p>
                      </div>
                      <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                        {isWhats ? "copiar e publicar" : "automático"}
                      </span>
                    </div>

                    <Textarea
                      className="mt-3 min-h-40 font-mono text-xs"
                      value={text}
                      onChange={(e) =>
                        setEditing((prev) => ({ ...prev, [item.id]: e.target.value }))
                      }
                    />

                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="gap-1"
                        onClick={async () =>
                          (await copyText(text))
                            ? toast.success("Mensagem copiada")
                            : toast.error("Não foi possível copiar")
                        }
                      >
                        <Copy className="size-3.5" /> Copiar
                      </Button>
                      {isWhats ? (
                        <>
                          <Button size="sm" className="gap-1" asChild>
                            <a
                              href={whatsappShareUrl(text)}
                              target="_blank"
                              rel="noreferrer noopener"
                            >
                              <Share2 className="size-3.5" /> Abrir WhatsApp
                            </a>
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 sm:hidden"
                            onClick={async () => {
                              const r = await shareText(text);
                              if (r === "failed") toast.error("Compartilhamento indisponível");
                            }}
                          >
                            <Share2 className="size-3.5" /> Compartilhar
                          </Button>
                        </>
                      ) : null}
                      {editing[item.id] !== undefined &&
                      editing[item.id] !== (item.content ?? "") ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => saveContent.mutate({ id: item.id, content: text })}
                        >
                          Salvar texto
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        onClick={() => markPublished.mutate(item.id)}
                      >
                        <Check className="size-3.5" /> Marcar publicada
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1 text-destructive"
                        onClick={() => remove.mutate(item.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </article>
                );
              })
            )}
          </section>

          {done.length > 0 ? (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-foreground">
                Publicadas ({done.length})
              </h2>
              {done.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground"
                >
                  <span className="truncate">
                    {item.groups?.name ?? "Sem grupo"} · {dateTime(item.scheduled_at)}
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => remove.mutate(item.id)}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ))}
            </section>
          ) : null}
        </div>
      )}
    </AppShell>
  );
}
