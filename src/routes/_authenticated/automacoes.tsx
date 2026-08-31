import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Zap,
  Plus,
  Play,
  Settings2,
  Trash2,
  Clock,
  Filter,
  Send,
  Rocket,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { BRAND } from "@/lib/branding";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  AutomationBuilderDialog,
  type AutomationRule,
} from "@/components/automacoes/AutomationBuilderDialog";
import { supabase } from "@/integrations/supabase/client";
import {
  listAutomations,
  saveAutomation,
  toggleAutomation,
  deleteAutomation,
  executeAutomation,
  executeAllAutomations,
} from "@/lib/automation.functions";

export const Route = createFileRoute("/_authenticated/automacoes")({
  head: () => ({
    meta: [
      { title: `Automações — ${BRAND.name}` },
      { name: "description", content: "Regras automáticas de captura, filtro e publicação real no Telegram." },
      { property: "og:title", content: `Automações — ${BRAND.name}` },
      { property: "og:description", content: "Regras automáticas de captura e publicação real no Telegram." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Automacoes,
});

type AutomationRow = {
  id: string;
  name: string;
  active: boolean;
  start_time: string;
  end_time: string;
  daily_limit: number;
  interval_minutes: number;
  group_id: string | null;
  template_id: string | null;
  config: Record<string, unknown> | null;
  last_run_at?: string | null;
};

const FALLBACK_COPY =
  "⚡ <b>{titulo}</b>\n\n💰 <b>{preco_por}</b> (era {preco_de})\n🏷️ {desconto}% OFF\n🏬 {loja}\n\n🔗 {link}";

function rowToRule(row: AutomationRow, sentToday: number): AutomationRule {
  const c = (row.config ?? {}) as Partial<AutomationRule>;
  return {
    id: row.id,
    name: row.name,
    enabled: row.active,
    trigger_type: c.trigger_type ?? "new_offer",
    trigger_interval: c.trigger_interval ?? "30m",
    min_score: c.min_score ?? 70,
    min_discount: c.min_discount ?? 20,
    min_price: c.min_price ?? 10,
    max_price: c.max_price ?? 5000,
    min_commission: c.min_commission ?? 0,
    marketplaces: c.marketplaces ?? [],
    categories: c.categories ?? [],
    blocked_words: c.blocked_words ?? "",
    only_free_shipping: c.only_free_shipping ?? false,
    only_with_coupon: c.only_with_coupon ?? false,
    group_ids: c.group_ids ?? [],
    copy_template_id: c.copy_template_id ?? "direct",
    custom_copy: c.custom_copy ?? FALLBACK_COPY,
    interval_minutes: row.interval_minutes,
    daily_limit: row.daily_limit,
    start_hour: (row.start_time ?? "08:00").slice(0, 5),
    end_hour: (row.end_time ?? "22:00").slice(0, 5),
    active_days: c.active_days ?? ["seg", "ter", "qua", "qui", "sex", "sab", "dom"],
    action_mode: c.action_mode ?? "auto_publish",
    today_sent_count: sentToday,
  };
}

function Automacoes() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
  const [executingRuleId, setExecutingRuleId] = useState<string | null>(null);

  const listFn = useServerFn(listAutomations);
  const saveFn = useServerFn(saveAutomation);
  const toggleFn = useServerFn(toggleAutomation);
  const deleteFn = useServerFn(deleteAutomation);
  const executeFn = useServerFn(executeAutomation);
  const executeAllFn = useServerFn(executeAllAutomations);

  const { data } = useQuery({
    queryKey: ["automations"],
    queryFn: () => listFn(),
  });

  const rules: AutomationRule[] = (data?.automations ?? []).map((row) =>
    rowToRule(row as AutomationRow, data?.sentToday?.[row.id] ?? 0),
  );

  const { data: groups = [] } = useQuery({
    queryKey: ["groups"],
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("groups")
        .select("*")
        .order("created_at", { ascending: false });
      return rows || [];
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["automations"] });

  const handleCreateNew = () => {
    setEditingRule(null);
    setDialogOpen(true);
  };

  const handleEdit = (rule: AutomationRule) => {
    setEditingRule(rule);
    setDialogOpen(true);
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      await toggleFn({ data: { id, active: enabled } });
      toast.success(enabled ? "Automação ativada!" : "Automação pausada.");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao atualizar automação.");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteFn({ data: { id } });
      toast.success("Regra de automação excluída.");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao excluir automação.");
    }
  };

  const handleSaveRule = async (rule: AutomationRule) => {
    try {
      const { id, name, enabled, interval_minutes, daily_limit, start_hour, end_hour, ...rest } =
        rule;
      await saveFn({
        data: {
          ...(id && !id.startsWith("rule-") ? { id } : {}),
          name,
          active: enabled,
          start_time: `${start_hour}:00`,
          end_time: `${end_hour}:00`,
          daily_limit,
          interval_minutes,
          group_id: rule.group_ids[0] ?? null,
          config: { ...rest, start_hour, end_hour } as Record<string, unknown>,
        },
      });
      toast.success("Automação salva no banco de dados.");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar automação.");
    }
  };

  const handleExecuteNow = async (rule: AutomationRule) => {
    if (!rule.id) return;
    setExecutingRuleId(rule.id);
    toast.loading(`Executando "${rule.name}" com ofertas reais...`, { id: "exec-rule" });
    try {
      const res = await executeFn({ data: { id: rule.id, ignoreWindow: true } });
      if (res.published + res.queued > 0) {
        toast.success(res.message, { id: "exec-rule" });
      } else {
        toast.warning(res.message, { id: "exec-rule" });
      }
      if (res.skipped.length > 0) {
        toast.message("Detalhes da execução", { description: res.skipped.slice(0, 3).join("\n") });
      }
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao executar regra.", { id: "exec-rule" });
    } finally {
      setExecutingRuleId(null);
    }
  };

  const handlePublishAll = async () => {
    toast.loading("Publicando todas as automações ativas...", { id: "exec-all" });
    try {
      const res = await executeAllFn();
      toast.success(
        `${res.total} automação(ões) executada(s): ${res.published} publicada(s) e ${res.queued} na fila.`,
        { id: "exec-all" },
      );
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao publicar automações.", {
        id: "exec-all",
      });
    }
  };

  const stepsOverview = [
    {
      num: "1",
      icon: Zap,
      color: "text-amber-500 bg-amber-500/10 border-amber-500/30",
      title: "1. Gatilhos",
      desc: "Nova oferta capturada, queda de preço detectada, mais vendidos ou agendamento recorrente.",
    },
    {
      num: "2",
      icon: Filter,
      color: "text-primary bg-primary/10 border-primary/30",
      title: "2. Filtros Avançados",
      desc: "Oferta Score mínimo, desconto %, faixa de preço R$, comissão mínima e lojas parceiras.",
    },
    {
      num: "3",
      icon: Send,
      color: "text-sky-500 bg-sky-500/10 border-sky-500/30",
      title: "3. Copy & Grupos",
      desc: "Escolha dos grupos/canais do Telegram, templates dinâmicos ({titulo}, {preco}, {link}) e preview.",
    },
    {
      num: "4",
      icon: Clock,
      color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/30",
      title: "4. Limites & Janelas",
      desc: "Intervalo entre envios (minutos), limite diário por grupo e horário permitido (ex: 08h às 22h).",
    },
  ];


  return (
    <AppShell
      title="Automações"
      description="Fluxo 100% automático: captura de ofertas, filtros, formatação de copy e publicação no Telegram"
      actions={
        <Button onClick={handleCreateNew} size="sm" className="gap-2">
          <Plus className="size-4" />
          Nova Regra de Automação
        </Button>
      }
    >
      {/* 4 ETAPAS EM DESTAQUE */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        {stepsOverview.map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.num}
              onClick={handleCreateNew}
              className="cursor-pointer rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/50 hover:shadow-sm"
            >
              <div className="flex items-center gap-2">
                <div className={`flex size-7 items-center justify-center rounded-lg border ${s.color}`}>
                  <Icon className="size-3.5" />
                </div>
                <h3 className="text-sm font-semibold text-foreground">{s.title}</h3>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{s.desc}</p>
            </div>
          );
        })}
      </div>

      {/* CABEÇALHO DA LISTA DE REGRAS */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Regras de Automação Ativas</h2>
          <p className="text-xs text-muted-foreground">
            {rules.filter((r) => r.enabled).length} de {rules.length} automações em execução contínua
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={handleCreateNew} className="text-xs gap-1.5">
          <Plus className="size-3.5" />
          Criar Regra
        </Button>
      </div>

      {rules.length === 0 ? (
        <EmptyState
          icon={<Zap className="size-6" />}
          title="Nenhuma automação configurada"
          description="Crie sua primeira regra para começar a publicar ofertas automaticamente nos seus canais e grupos do Telegram."
          action={
            <Button onClick={handleCreateNew} size="sm" className="gap-1.5 mt-2">
              <Plus className="size-4" />
              Criar primeira automação
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => {
            const isExecuting = executingRuleId === rule.id;
            const targetCount = rule.group_ids.length > 0 ? rule.group_ids.length : groups.length;

            return (
              <div
                key={rule.id}
                className={`flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-xl border p-4 transition-all bg-card ${
                  rule.enabled ? "border-border hover:border-primary/40" : "border-border/60 opacity-60"
                }`}
              >
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-foreground">{rule.name}</h3>
                    <Badge variant={rule.enabled ? "default" : "secondary"} className="text-[10px]">
                      {rule.enabled ? "Ativa" : "Pausada"}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] uppercase font-mono">
                      {rule.trigger_type === "top_sellers"
                        ? "Mais Vendidos"
                        : rule.trigger_type === "price_drop"
                        ? "Queda de Preço"
                        : rule.trigger_type === "scheduled"
                        ? `Agendado (${rule.trigger_interval || "30m"})`
                        : "Nova Oferta"}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Filter className="size-3 text-primary" />
                      Score &gt;= <strong>{rule.min_score}</strong> | Desconto &gt;= <strong>{rule.min_discount}%</strong>
                    </span>
                    <span className="flex items-center gap-1">
                      <Send className="size-3 text-sky-500" />
                      <strong>{targetCount}</strong> grupo(s) Telegram
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="size-3 text-emerald-500" />
                      Intervalo: <strong>{rule.interval_minutes}min</strong> | {rule.start_hour} às {rule.end_hour}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 pt-1 text-[11px] text-muted-foreground">
                    <span>Lojas:</span>
                    {rule.marketplaces.map((m) => (
                      <span key={m} className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase font-semibold text-foreground">
                        {m}
                      </span>
                    ))}
                    <span className="ml-2 text-foreground font-semibold">
                      Envios hoje: {rule.today_sent_count || 0}/{rule.daily_limit}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 border-t md:border-t-0 pt-3 md:pt-0 border-border">
                  <div className="flex items-center gap-2 mr-2">
                    <Switch
                      checked={rule.enabled}
                      onCheckedChange={(checked) => handleToggle(rule.id!, checked)}
                    />
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs gap-1.5 text-amber-600 hover:text-amber-700"
                    disabled={isExecuting}
                    onClick={() => handleExecuteNow(rule)}
                  >
                    <Play className={`size-3 ${isExecuting ? "animate-spin" : ""}`} />
                    {isExecuting ? "Disparando..." : "Executar Agora"}
                  </Button>

                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8"
                    onClick={() => handleEdit(rule)}
                    title="Editar automação"
                  >
                    <Settings2 className="size-3.5" />
                  </Button>

                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8 text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      if (confirm(`Excluir a regra "${rule.name}"?`)) {
                        handleDelete(rule.id!);
                      }
                    }}
                    title="Excluir automação"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* DIALOG DO BUILDER */}
      <AutomationBuilderDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initialRule={editingRule}
        onSaved={handleSaveRule}
      />
    </AppShell>
  );
}
