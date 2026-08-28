import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Users } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { AppShell } from "@/components/layout/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { supabase } from "@/integrations/supabase/client";
import { BRAND } from "@/lib/branding";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/grupos")({
  head: () => ({
    meta: [
      { title: `Grupos — ${BRAND.name}` },
      { name: "description", content: "Grupos e canais de destino das publicações." },
      { property: "og:title", content: `Grupos — ${BRAND.name}` },
      { property: "og:description", content: "Grupos e canais de destino das publicações." },
    ],
  }),
  component: Grupos,
});

const schema = z.object({
  name: z.string().trim().min(2, "Informe um nome").max(80),
  identifier: z.string().trim().max(120).optional(),
  platform: z.enum(["whatsapp", "telegram"]),
  min_score: z.number().min(0).max(100),
});

function Grupos() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [platform, setPlatform] = useState<"whatsapp" | "telegram">("telegram");
  const [minScore, setMinScore] = useState("70");

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ["groups"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("groups")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const parsed = schema.safeParse({
        name,
        identifier,
        platform,
        min_score: Number(minScore),
      });
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message);
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Sessão expirada");
      const { error } = await supabase.from("groups").insert({
        name: parsed.data.name,
        identifier: parsed.data.identifier || null,
        platform: parsed.data.platform,
        min_score: parsed.data.min_score,
        user_id: userId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Grupo criado");
      setOpen(false);
      setName("");
      setIdentifier("");
      qc.invalidateQueries({ queryKey: ["groups"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao criar grupo"),
  });

  const form = (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Novo grupo</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo grupo</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="g-name">Nome</Label>
            <Input id="g-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="g-id">Identificador do canal (opcional)</Label>
            <Input
              id="g-id"
              value={identifier}
              maxLength={120}
              placeholder="@meucanal ou ID do grupo"
              onChange={(e) => setIdentifier(e.target.value)}
            />
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
              <Label htmlFor="g-score">Score mínimo</Label>
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
          <Button className="w-full" onClick={() => create.mutate()} disabled={create.isPending}>
            {create.isPending ? "Salvando..." : "Criar grupo"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );

  return (
    <AppShell title="Grupos" description="Destinos das publicações" actions={form}>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : groups.length === 0 ? (
        <EmptyState
          icon={<Users className="size-6" />}
          title="Nenhum grupo cadastrado"
          description="Crie um grupo e conecte o canal oficial (WhatsApp Cloud API ou Telegram Bot API) em Integrações."
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {groups.map((g) => (
            <div key={g.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">{g.name}</h3>
                <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                  {g.platform}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {g.identifier ?? "Canal não conectado"}
              </p>
              <dl className="mt-3 grid grid-cols-3 gap-2 text-[11px] text-muted-foreground">
                <div>
                  <dt>Score mín.</dt>
                  <dd className="font-semibold text-foreground">{g.min_score}</dd>
                </div>
                <div>
                  <dt>Limite/dia</dt>
                  <dd className="font-semibold text-foreground">{g.daily_limit}</dd>
                </div>
                <div>
                  <dt>Intervalo</dt>
                  <dd className="font-semibold text-foreground">{g.interval_minutes} min</dd>
                </div>
              </dl>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
