import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Users, Send, MessageSquare, Trash2, Edit, Radio, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { AppShell } from "@/components/layout/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { supabase } from "@/integrations/supabase/client";
import { BRAND } from "@/lib/branding";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TelegramQrConnector } from "@/components/telegram/TelegramQrConnector";
import { sendTelegramMessage } from "@/lib/telegram.functions";

export const Route = createFileRoute("/_authenticated/grupos")({
  head: () => ({
    meta: [
      { title: `Grupos e Canais — ${BRAND.name}` },
      { name: "description", content: "Grupos e canais de destino das publicações automáticas." },
      { property: "og:title", content: `Grupos e Canais — ${BRAND.name}` },
      { property: "og:description", content: "Grupos e canais de destino das publicações automáticas." },
    ],
  }),
  component: Grupos,
});

const schema = z.object({
  name: z.string().trim().min(2, "Informe um nome").max(80),
  identifier: z.string().trim().max(120).optional(),
  platform: z.enum(["whatsapp", "telegram"]),
  min_score: z.number().min(0).max(100),
  daily_limit: z.number().min(1).max(200).optional(),
  interval_minutes: z.number().min(1).max(1440).optional(),
});

interface GroupItem {
  id: string;
  name: string;
  identifier: string | null;
  platform: "whatsapp" | "telegram";
  min_score: number;
  daily_limit: number;
  interval_minutes: number;
  category?: string | null;
  status?: string | null;
  created_at?: string;
}

function Grupos() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<GroupItem | null>(null);
  const [name, setName] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [platform, setPlatform] = useState<"whatsapp" | "telegram">("telegram");
  const [minScore, setMinScore] = useState("70");
  const [dailyLimit, setDailyLimit] = useState("20");
  const [intervalMinutes, setIntervalMinutes] = useState("30");

  const [testModalOpen, setTestModalOpen] = useState(false);
  const [testTargetGroup, setTestTargetGroup] = useState<GroupItem | null>(null);
  const [testMsg, setTestMsg] = useState("🔥 Oferta Teste Oferta Surge:\n\n*Smart TV 50\" 4K*\nDe: R$ 2.499,00\nPor: R$ 1.699,00 (32% OFF)\n\n👉 Compre aqui: https://shope.ee/exemplo");

  const [filterPlatform, setFilterPlatform] = useState<string>("all");

  const sendMsgFn = useServerFn(sendTelegramMessage);

  const { data: groups = [], isLoading } = useQuery<GroupItem[]>({
    queryKey: ["groups"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("groups")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as GroupItem[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const parsed = schema.safeParse({
        name,
        identifier,
        platform,
        min_score: Number(minScore),
        daily_limit: Number(dailyLimit),
        interval_minutes: Number(intervalMinutes),
      });
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message);
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Sessão expirada");

      if (editingGroup) {
        const { error } = await supabase
          .from("groups")
          .update({
            name: parsed.data.name,
            identifier: parsed.data.identifier || null,
            platform: parsed.data.platform,
            min_score: parsed.data.min_score,
            daily_limit: parsed.data.daily_limit,
            interval_minutes: parsed.data.interval_minutes,
          })
          .eq("id", editingGroup.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("groups").insert({
          name: parsed.data.name,
          identifier: parsed.data.identifier || null,
          platform: parsed.data.platform,
          min_score: parsed.data.min_score,
          daily_limit: parsed.data.daily_limit,
          interval_minutes: parsed.data.interval_minutes,
          user_id: userId,
          status: "connected",
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingGroup ? "Grupo atualizado!" : "Grupo criado com sucesso!");
      setOpen(false);
      setEditingGroup(null);
      setName("");
      setIdentifier("");
      qc.invalidateQueries({ queryKey: ["groups"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao salvar grupo"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("groups").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Grupo removido.");
      qc.invalidateQueries({ queryKey: ["groups"] });
    },
    onError: () => toast.error("Falha ao remover grupo."),
  });

  const sendTestMutation = useMutation({
    mutationFn: async ({ groupId, text }: { groupId: string; text: string }) => {
      return sendMsgFn({ data: { groupId, text } });
    },
    onSuccess: (res) => {
      if (res.ok) {
        toast.success(res.message);
        setTestModalOpen(false);
      } else {
        toast.error(res.message);
      }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao enviar teste."),
  });

  const startEdit = (g: GroupItem) => {
    setEditingGroup(g);
    setName(g.name);
    setIdentifier(g.identifier ?? "");
    setPlatform(g.platform);
    setMinScore(String(g.min_score));
    setDailyLimit(String(g.daily_limit || 20));
    setIntervalMinutes(String(g.interval_minutes || 30));
    setOpen(true);
  };

  const startNew = () => {
    setEditingGroup(null);
    setName("");
    setIdentifier("");
    setPlatform("telegram");
    setMinScore("70");
    setDailyLimit("20");
    setIntervalMinutes("30");
    setOpen(true);
  };

  const filteredGroups = groups.filter((g) => {
    if (filterPlatform === "all") return true;
    return g.platform === filterPlatform;
  });

  const actions = (
    <div className="flex flex-wrap items-center gap-2">
      <TelegramQrConnector onGroupsUpdated={() => qc.invalidateQueries({ queryKey: ["groups"] })} />
      <Button size="sm" onClick={startNew} className="gap-1.5">
        <Users className="size-4" />
        Novo grupo manual
      </Button>
    </div>
  );

  return (
    <AppShell title="Grupos e Canais" description="Destinos das publicações automáticas no Telegram e WhatsApp" actions={actions}>
      {/* Platform Filter Tabs */}
      <div className="flex items-center gap-2 mb-4">
        <Button
          size="sm"
          variant={filterPlatform === "all" ? "default" : "outline"}
          onClick={() => setFilterPlatform("all")}
          className="text-xs h-8"
        >
          Todos ({groups.length})
        </Button>
        <Button
          size="sm"
          variant={filterPlatform === "telegram" ? "default" : "outline"}
          onClick={() => setFilterPlatform("telegram")}
          className="text-xs h-8 gap-1.5"
        >
          <Send className="size-3.5 text-sky-500" />
          Telegram ({groups.filter((g) => g.platform === "telegram").length})
        </Button>
        <Button
          size="sm"
          variant={filterPlatform === "whatsapp" ? "default" : "outline"}
          onClick={() => setFilterPlatform("whatsapp")}
          className="text-xs h-8 gap-1.5"
        >
          <MessageSquare className="size-3.5 text-emerald-500" />
          WhatsApp ({groups.filter((g) => g.platform === "whatsapp").length})
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Carregando grupos...</p>
      ) : filteredGroups.length === 0 ? (
        <EmptyState
          icon={<Users className="size-6" />}
          title="Nenhum grupo encontrado"
          description="Conecte seu Telegram usando o botão 'Conectar Telegram via QR Code' acima para importar todos os seus grupos e canais automaticamente, ou cadastre um grupo manualmente."
          action={
            <div className="flex gap-2 mt-2">
              <TelegramQrConnector onGroupsUpdated={() => qc.invalidateQueries({ queryKey: ["groups"] })} />
              <Button size="sm" variant="outline" onClick={startNew}>
                Cadastrar manualmente
              </Button>
            </div>
          }
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filteredGroups.map((g) => {
            const isTelegram = g.platform === "telegram";
            const isChannel = g.category === "channel" || g.identifier?.startsWith("@") || g.identifier?.startsWith("-100");

            return (
              <div key={g.id} className="flex flex-col justify-between rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/40">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className={`flex size-7 items-center justify-center rounded-lg ${isTelegram ? "bg-sky-500/10 text-sky-500" : "bg-emerald-500/10 text-emerald-500"}`}>
                        {isTelegram ? <Send className="size-3.5" /> : <MessageSquare className="size-3.5" />}
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-foreground leading-none">{g.name}</h3>
                        <p className="mt-1 text-xs font-mono text-muted-foreground">
                          {g.identifier ?? "Sem identificador"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <Badge variant="outline" className={`text-[10px] uppercase font-semibold ${isTelegram ? "border-sky-500/30 bg-sky-500/10 text-sky-600" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-600"}`}>
                        {g.platform}
                      </Badge>
                      {g.category && (
                        <Badge variant="secondary" className="text-[10px]">
                          {g.category === "channel" ? "Canal" : g.category === "supergroup" ? "Supergrupo" : g.category}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <dl className="mt-4 grid grid-cols-3 gap-2 rounded-lg bg-muted/30 p-2.5 text-[11px] text-muted-foreground">
                    <div>
                      <dt className="text-[10px] text-muted-foreground">Score Mín.</dt>
                      <dd className="font-semibold text-foreground">{g.min_score} pts</dd>
                    </div>
                    <div>
                      <dt className="text-[10px] text-muted-foreground">Limite Diário</dt>
                      <dd className="font-semibold text-foreground">{g.daily_limit || 20} msgs</dd>
                    </div>
                    <div>
                      <dt className="text-[10px] text-muted-foreground">Intervalo</dt>
                      <dd className="font-semibold text-foreground">{g.interval_minutes || 30} min</dd>
                    </div>
                  </dl>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                  {isTelegram ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs gap-1.5 text-sky-600 hover:text-sky-700"
                      onClick={() => {
                        setTestTargetGroup(g);
                        setTestModalOpen(true);
                      }}
                    >
                      <Send className="size-3" />
                      Testar Envio
                    </Button>
                  ) : (
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <CheckCircle2 className="size-3 text-emerald-500" /> WhatsApp Ativo
                    </span>
                  )}

                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="ghost" className="size-8" onClick={() => startEdit(g)} title="Editar configurações">
                      <Edit className="size-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-8 text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        if (confirm(`Remover o grupo "${g.name}"?`)) {
                          deleteMutation.mutate(g.id);
                        }
                      }}
                      title="Excluir grupo"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* DIALOG DE CRIAR/EDITAR GRUPO MANUAL */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingGroup ? "Editar Grupo" : "Novo Grupo / Canal"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="g-name">Nome do Grupo ou Canal</Label>
              <Input id="g-name" value={name} maxLength={80} placeholder="Ex: Ofertas VIP Telegram" onChange={(e) => setName(e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="g-id">Identificador (@canal ou Chat ID numérico)</Label>
              <Input
                id="g-id"
                value={identifier}
                maxLength={120}
                placeholder="Ex: @meucanal ou -100123456789"
                onChange={(e) => setIdentifier(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                No Telegram você pode usar o @username do canal público ou o Chat ID numérico obtido via QR Code.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Plataforma</Label>
                <Select value={platform} onValueChange={(v) => setPlatform(v as typeof platform)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="telegram">Telegram</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="g-score">Score Mínimo (0-100)</Label>
                <Input
                  id="g-score"
                  type="number"
                  min={0}
                  max={100}
                  value={minScore}
                  onChange={(e) => setMinScore(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="g-limit">Limite Diário (mensagens)</Label>
                <Input
                  id="g-limit"
                  type="number"
                  min={1}
                  max={200}
                  value={dailyLimit}
                  onChange={(e) => setDailyLimit(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="g-interval">Intervalo Mínimo (minutos)</Label>
                <Input
                  id="g-interval"
                  type="number"
                  min={1}
                  max={1440}
                  value={intervalMinutes}
                  onChange={(e) => setIntervalMinutes(e.target.value)}
                />
              </div>
            </div>

            <Button className="w-full mt-2" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Salvando..." : editingGroup ? "Atualizar Grupo" : "Criar Grupo"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* DIALOG DE TESTE DE ENVIO PARA O TELEGRAM */}
      <Dialog open={testModalOpen} onOpenChange={setTestModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="size-4 text-sky-500" />
              Testar Envio: {testTargetGroup?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs">Mensagem de Teste (HTML / Texto formatado)</Label>
              <textarea
                rows={5}
                className="w-full rounded-md border border-input bg-background p-2.5 text-xs font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={testMsg}
                onChange={(e) => setTestMsg(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                A mensagem será enviada imediatamente para <strong>{testTargetGroup?.identifier}</strong>.
              </p>
            </div>

            <DialogFooter>
              <Button variant="ghost" size="sm" onClick={() => setTestModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                size="sm"
                className="gap-2"
                disabled={sendTestMutation.isPending || !testTargetGroup}
                onClick={() => {
                  if (testTargetGroup) {
                    sendTestMutation.mutate({ groupId: testTargetGroup.id, text: testMsg });
                  }
                }}
              >
                <Send className="size-3.5" />
                {sendTestMutation.isPending ? "Enviando..." : "Enviar Agora"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
