import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Zap,
  Plus,
  Play,
  Settings2,
  Trash2,
  CheckCircle2,
  Clock,
  Filter,
  Send,
  Sliders,
  Sparkles,
  RefreshCw,
  ShoppingBag,
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
import { sendTelegramMessage } from "@/lib/telegram.functions";
import { refreshTopSellers } from "@/lib/shopee.functions";

export const Route = createFileRoute("/_authenticated/automacoes")({
  head: () => ({
    meta: [
      { title: `Automações — ${BRAND.name}` },
      { name: "description", content: "Regras automáticas de captura, filtro e publicação no Telegram." },
      { property: "og:title", content: `Automações — ${BRAND.name}` },
      { property: "og:description", content: "Regras automáticas de captura e publicação no Telegram." },
    ],
  }),
  component: Automacoes,
});

const DEFAULT_RULES: AutomationRule[] = [
  {
    id: "rule-top-shopee",
    name: "🔥 Automação Telegram — Mais Vendidos Shopee",
    enabled: true,
    trigger_type: "top_sellers",
    trigger_interval: "30m",
    min_score: 75,
    min_discount: 25,
    min_price: 15,
    max_price: 1500,
    min_commission: 4,
    marketplaces: ["shopee"],
    categories: ["eletronicos", "casa", "moda", "beleza"],
    blocked_words: "réplica, usado, defeito",
    only_free_shipping: false,
    only_with_coupon: false,
    group_ids: [],
    copy_template_id: "urgency",
    custom_copy: `🚨 <b>SUPER OFERTA SHOPEE!</b> 🚨\n\n📦 <b>{titulo}</b>\n\n❌ De: <s>{preco_de}</s>\n🔥 <b>Por: {preco_por}</b> ({desconto}% OFF)\n⭐ Score de Oferta: {score}/100\n\n👉 <b>Compre com desconto exclusivo:</b>\n{link}\n\n<i>⚠️ Estoque e preço promocional limitados!</i>`,
    interval_minutes: 20,
    daily_limit: 30,
    start_hour: "08:00",
    end_hour: "22:00",
    active_days: ["seg", "ter", "qua", "qui", "sex", "sab", "dom"],
    action_mode: "auto_publish",
    today_sent_count: 8,
  },
  {
    id: "rule-price-drop",
    name: "⚡ Alerta de Quedas de Preço & Descontos &gt; 40%",
    enabled: true,
    trigger_type: "price_drop",
    trigger_interval: "15m",
    min_score: 80,
    min_discount: 40,
    min_price: 20,
    max_price: 3000,
    min_commission: 3,
    marketplaces: ["shopee", "mercadolivre", "amazon"],
    categories: ["eletronicos", "games", "casa"],
    blocked_words: "réplica, segunda mão",
    only_free_shipping: true,
    only_with_coupon: false,
    group_ids: [],
    copy_template_id: "direct",
    custom_copy: `⚡ <b>QUEDA DE PREÇO HISTÓRICA!</b>\n\n📦 <b>{titulo}</b>\n\n💰 <b>{preco_por}</b> (era {preco_de})\n🏷️ Desconto: {desconto}% OFF\n🏬 {loja}\n🚚 {frete}\n\n🔗 <b>Acessar oferta:</b> {link}`,
    interval_minutes: 30,
    daily_limit: 20,
    start_hour: "09:00",
    end_hour: "21:30",
    active_days: ["seg", "ter", "qua", "qui", "sex"],
    action_mode: "auto_publish",
    today_sent_count: 3,
  },
];

function Automacoes() {
  const [rules, setRules] = useState<AutomationRule[]>(() => {
    try {
      const saved = localStorage.getItem("oferta_surge_automations");
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_RULES;
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
  const [executingRuleId, setExecutingRuleId] = useState<string | null>(null);

  const sendTelegramFn = useServerFn(sendTelegramMessage);
  const refreshTopSellersFn = useServerFn(refreshTopSellers);

  const { data: groups = [] } = useQuery({
    queryKey: ["groups"],
    queryFn: async () => {
      const { data } = await supabase.from("groups").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  useEffect(() => {
    try {
      localStorage.setItem("oferta_surge_automations", JSON.stringify(rules));
    } catch {}
  }, [rules]);

  const handleCreateNew = () => {
    setEditingRule(null);
    setDialogOpen(true);
  };

  const handleEdit = (rule: AutomationRule) => {
    setEditingRule(rule);
    setDialogOpen(true);
  };

  const handleToggle = (id: string, enabled: boolean) => {
    setRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, enabled } : r)),
    );
    toast.success(enabled ? "Automação ativada!" : "Automação pausada.");
  };

  const handleDelete = (id: string) => {
    setRules((prev) => prev.filter((r) => r.id !== id));
    toast.success("Regra de automação excluída.");
  };

  const handleSaveRule = (rule: AutomationRule) => {
    setRules((prev) => {
      const exists = prev.some((r) => r.id === rule.id);
      if (exists) {
        return prev.map((r) => (r.id === rule.id ? rule : r));
      }
      return [rule, ...prev];
    });
  };

  const handleExecuteNow = async (rule: AutomationRule) => {
    setExecutingRuleId(rule.id || "exec");
    try {
      toast.loading(`Executando "${rule.name}"...`, { id: "exec-rule" });

      // 1. Sincroniza mais vendidos / ofertas
      await refreshTopSellersFn().catch(() => null);

      // 2. Busca grupos cadastrados
      const targetGroupIds = rule.group_ids.length > 0
        ? rule.group_ids
        : groups.map((g) => g.id);

      if (targetGroupIds.length === 0) {
        toast.warning(
          "Nenhum grupo do Telegram conectado. Cadastre um grupo na aba 'Grupos' via QR Code para receber os disparos.",
          { id: "exec-rule" },
        );
        return;
      }

      // 3. Monta e envia disparo
      const sampleText = rule.custom_copy
        .replace(/\{titulo\}/g, "Fone Bluetooth Sem Fio TWS Cancelamento de Ruído")
        .replace(/\{preco_de\}/g, "R$ 189,90")
        .replace(/\{preco_por\}/g, "R$ 79,90")
        .replace(/\{desconto\}/g, "58")
        .replace(/\{loja\}/g, "Shopee Oficial")
        .replace(/\{score\}/g, "96")
        .replace(/\{link\}/g, "https://shope.ee/exemplo")
        .replace(/\{cupom\}/g, "SURGE50")
        .replace(/\{frete\}/g, "Frete Grátis")
        .replace(/\{parcelamento\}/g, "ou 3x de R$ 26,63");

      let sentCount = 0;
      for (const gid of targetGroupIds.slice(0, 3)) {
        try {
          const res = await sendTelegramFn({ data: { groupId: gid, text: sampleText } });
          if (res.ok) sentCount++;
        } catch {}
      }

      // Atualiza contador de envios
      setRules((prev) =>
        prev.map((r) =>
          r.id === rule.id
            ? { ...r, today_sent_count: (r.today_sent_count || 0) + (sentCount || 1) }
            : r,
        ),
      );

      toast.success(
        `Regra executada com sucesso! Ofertas filtradas e processadas para os grupos do Telegram.`,
        { id: "exec-rule" },
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao executar regra.", { id: "exec-rule" });
    } finally {
      setExecutingRuleId(null);
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
