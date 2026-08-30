import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Users,
  Search,
  RefreshCw,
  Settings,
  CheckCircle2,
  XCircle,
  Clock,
  Send,
  Sparkles,
  Sliders,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { WhatsAppNav } from "@/components/whatsapp/WhatsAppNav";
import { GroupConfigDialog } from "@/components/whatsapp/GroupConfigDialog";
import { BRAND } from "@/lib/branding";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { WhatsAppGroupDto } from "@/lib/whatsapp/types";
import {
  listWhatsAppGroups,
  syncWhatsAppGroups,
  updateWhatsAppGroupConfig,
} from "@/lib/whatsapp/whatsapp.functions";

export const Route = createFileRoute("/_authenticated/whatsapp/grupos")({
  head: () => ({
    meta: [
      { title: `Meus Grupos WhatsApp — ${BRAND.name}` },
      { name: "description", content: "Gerencie e configure os grupos do WhatsApp para automação de ofertas." },
      { property: "og:title", content: `Meus Grupos WhatsApp — ${BRAND.name}` },
      { property: "og:description", content: "Gerencie e configure os grupos do WhatsApp." },
    ],
  }),
  component: WhatsAppGruposPage,
});

function WhatsAppGruposPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [selectionFilter, setSelectionFilter] = useState<"all" | "selected" | "unselected">("all");
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "inactive">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const [configModalGroup, setConfigModalGroup] = useState<WhatsAppGroupDto | null>(null);
  const [configModalOpen, setConfigModalOpen] = useState(false);

  const fetchGroupsFn = useServerFn(listWhatsAppGroups);
  const syncGroupsFn = useServerFn(syncWhatsAppGroups);
  const updateConfigFn = useServerFn(updateWhatsAppGroupConfig);

  const { data: groups = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["whatsapp-groups"],
    queryFn: () => fetchGroupsFn(),
  });

  const syncMutation = useMutation({
    mutationFn: async () => syncGroupsFn(),
    onSuccess: (res) => {
      toast.success(res.message);
      refetch();
      qc.invalidateQueries({ queryKey: ["whatsapp-groups"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao sincronizar grupos."),
  });

  const toggleSelectMutation = useMutation({
    mutationFn: async ({ groupId, is_selected }: { groupId: string; is_selected: boolean }) => {
      return updateConfigFn({ data: { groupId, is_selected } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["whatsapp-groups"] });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ groupId, is_active }: { groupId: string; is_active: boolean }) => {
      return updateConfigFn({ data: { groupId, is_active } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["whatsapp-groups"] });
    },
  });

  const lastSyncDate = useMemo(() => {
    if (groups.length === 0) return null;
    const dates = groups
      .map((g) => g.last_synced_at || g.updated_at)
      .filter(Boolean)
      .sort();
    if (dates.length === 0) return null;
    return new Date(dates[dates.length - 1]!).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [groups]);

  const filteredGroups = useMemo(() => {
    return groups.filter((g) => {
      const matchSearch =
        !q.trim() ||
        g.name.toLowerCase().includes(q.toLowerCase()) ||
        g.external_group_id.toLowerCase().includes(q.toLowerCase());

      const matchSelection =
        selectionFilter === "all" ||
        (selectionFilter === "selected" && g.is_selected) ||
        (selectionFilter === "unselected" && !g.is_selected);

      const matchActive =
        activeFilter === "all" ||
        (activeFilter === "active" && g.is_active) ||
        (activeFilter === "inactive" && !g.is_active);

      const matchCategory =
        categoryFilter === "all" || (g.category_id || "geral") === categoryFilter;

      return matchSearch && matchSelection && matchActive && matchCategory;
    });
  }, [groups, q, selectionFilter, activeFilter, categoryFilter]);

  const handleOpenConfig = (group: WhatsAppGroupDto) => {
    setConfigModalGroup(group);
    setConfigModalOpen(true);
  };

  return (
    <AppShell
      title="Meus Grupos WhatsApp"
      description="Selecione e configure quais grupos receberão as ofertas automáticas"
      actions={
        <div className="flex items-center gap-3">
          {lastSyncDate && (
            <span className="text-[11px] text-muted-foreground hidden sm:inline-block">
              Última sincronização: <strong>{lastSyncDate}</strong>
            </span>
          )}
          <Button
            size="sm"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending || isRefetching}
            className="gap-2 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <RefreshCw className={`size-3.5 ${syncMutation.isPending ? "animate-spin" : ""}`} />
            {syncMutation.isPending ? "Sincronizando..." : "↻ Sincronizar grupos"}
          </Button>
        </div>
      }
    >
      <WhatsAppNav />

      {/* BARRA DE PESQUISA E FILTROS */}
      <div className="grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-4 mb-6">
        <div className="relative">
          <Search className="size-4 absolute left-3 top-2.5 text-muted-foreground" />
          <Input
            placeholder="🔎 Pesquisar grupo por nome..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>

        <div>
          <Select
            value={selectionFilter}
            onValueChange={(v) => setSelectionFilter(v as typeof selectionFilter)}
          >
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Seleção para automação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os grupos</SelectItem>
              <SelectItem value="selected">Apenas Selecionados</SelectItem>
              <SelectItem value="unselected">Não Selecionados</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Select
            value={activeFilter}
            onValueChange={(v) => setActiveFilter(v as typeof activeFilter)}
          >
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="active">Ativos</SelectItem>
              <SelectItem value="inactive">Inativos</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Categorias</SelectItem>
              <SelectItem value="geral">Geral / Cupons</SelectItem>
              <SelectItem value="casa">Casa & Decoração</SelectItem>
              <SelectItem value="eletronicos">Eletrônicos</SelectItem>
              <SelectItem value="moda">Moda & Beleza</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* LISTAGEM DOS GRUPOS */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground py-12 text-center">Carregando grupos...</p>
      ) : filteredGroups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center space-y-3">
          <Users className="size-8 mx-auto text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Nenhum grupo encontrado</h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            {groups.length === 0
              ? "Conecte sua conta do WhatsApp na aba Conexões e clique em 'Sincronizar Grupos' para importar os grupos."
              : "Nenhum grupo atende aos filtros de pesquisa atuais."}
          </p>
          {groups.length === 0 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button
                size="sm"
                variant="outline"
                asChild
                className="gap-1.5 text-xs"
              >
                <a href="/whatsapp/conexoes">Conectar WhatsApp</a>
              </Button>
              <Button
                size="sm"
                onClick={() => syncMutation.mutate()}
                disabled={syncMutation.isPending}
                className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
              >
                <RefreshCw className="size-3.5" />
                Sincronizar Grupos Reais
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filteredGroups.map((group) => (
            <div
              key={group.id}
              className={`flex flex-col justify-between rounded-xl border p-4 transition-all bg-card ${
                group.is_selected
                  ? "border-emerald-500/50 shadow-sm"
                  : "border-border opacity-75"
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {group.image_url ? (
                      <img
                        src={group.image_url}
                        alt={group.name}
                        className="size-11 rounded-full object-cover border border-border shrink-0"
                      />
                    ) : (
                      <div className="flex size-11 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 font-bold border border-emerald-500/20 shrink-0">
                        <Users className="size-5" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-foreground truncate">
                        {group.name}
                      </h3>
                      <p className="text-[11px] text-muted-foreground">
                        {group.participant_count} participantes
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <Badge
                      variant="outline"
                      className={`text-[10px] uppercase font-semibold ${
                        group.is_active
                          ? "border-emerald-500/40 text-emerald-600 bg-emerald-500/10"
                          : "border-border text-muted-foreground bg-muted"
                      }`}
                    >
                      {group.is_active ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                </div>

                {group.description && (
                  <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
                    {group.description}
                  </p>
                )}

                <dl className="mt-3 grid grid-cols-3 gap-2 rounded-lg bg-muted/40 p-2.5 text-[11px] text-muted-foreground">
                  <div>
                    <dt className="text-[10px]">Score Mín.</dt>
                    <dd className="font-semibold text-foreground">{group.minimum_offer_score} pts</dd>
                  </div>
                  <div>
                    <dt className="text-[10px]">Limite/Dia</dt>
                    <dd className="font-semibold text-foreground">{group.daily_limit} msgs</dd>
                  </div>
                  <div>
                    <dt className="text-[10px]">Intervalo</dt>
                    <dd className="font-semibold text-foreground">{group.posting_interval_minutes} min</dd>
                  </div>
                </dl>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                <Button
                  size="sm"
                  variant={group.is_selected ? "default" : "outline"}
                  className={`h-8 text-xs gap-1.5 ${
                    group.is_selected
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                      : "text-muted-foreground"
                  }`}
                  onClick={() =>
                    toggleSelectMutation.mutate({
                      groupId: group.id,
                      is_selected: !group.is_selected,
                    })
                  }
                >
                  <CheckCircle2 className="size-3.5" />
                  {group.is_selected ? "Selecionado" : "Selecionar"}
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs gap-1.5"
                  onClick={() => handleOpenConfig(group)}
                >
                  <Settings className="size-3.5" />
                  Configurar
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL DE CONFIGURAÇÃO INDIVIDUAL DO GRUPO */}
      <GroupConfigDialog
        open={configModalOpen}
        onOpenChange={setConfigModalOpen}
        group={configModalGroup}
      />
    </AppShell>
  );
}
