import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Zap,
  Filter,
  FileText,
  Clock,
  Send,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Tag,
  ShoppingBag,
  Sliders,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { sendTelegramMessage } from "@/lib/telegram.functions";

export interface AutomationRule {
  id?: string;
  name: string;
  enabled: boolean;
  trigger_type: "new_offer" | "price_drop" | "scheduled" | "top_sellers";
  trigger_interval?: string;
  min_score: number;
  min_discount: number;
  min_price: number;
  max_price: number;
  min_commission: number;
  marketplaces: string[];
  categories: string[];
  blocked_words: string;
  only_free_shipping: boolean;
  only_with_coupon: boolean;
  group_ids: string[];
  copy_template_id: string;
  custom_copy: string;
  interval_minutes: number;
  daily_limit: number;
  start_hour: string;
  end_hour: string;
  active_days: string[];
  action_mode: "auto_publish" | "queue_for_review";
  today_sent_count?: number;
  created_at?: string;
}

const COPY_TEMPLATES = [
  {
    id: "urgency",
    name: "🔥 Urgência / Mega Oferta",
    text: `🚨 <b>MEGA OFERTA ENCONTRADA!</b> 🚨\n\n📦 <b>{titulo}</b>\n\n❌ De: <s>{preco_de}</s>\n🔥 <b>Por: {preco_por}</b> ({desconto}% OFF)\n🏪 Loja: <b>{loja}</b>\n⭐ Score: {score}/100\n\n👉 <b>Compre agora com desconto:</b>\n{link}\n\n<i>⚠️ Preço sujeito a alteração a qualquer momento!</i>`,
  },
  {
    id: "direct",
    name: "⚡ Direto ao Ponto",
    text: `⚡ <b>{titulo}</b>\n\n💰 <b>{preco_por}</b> (era {preco_de})\n🏷️ Desconto: {desconto}%\n🏬 {loja}\n\n🔗 {link}`,
  },
  {
    id: "coupon",
    name: "🏷️ Com Cupom de Desconto",
    text: `🎟️ <b>CUPOM + DESCONTO ATIVO!</b>\n\n✨ <b>{titulo}</b>\n💵 De {preco_de} por apenas <b>{preco_por}</b>!\n\n🎟️ Use o cupom na loja: <code>{cupom}</code>\n🛒 Compre aqui: {link}\n\n<i>Aproveite antes que o cupom esgote!</i>`,
  },
  {
    id: "savings",
    name: "💰 Economia Máxima / Cashback",
    text: `💸 <b>ECONOMIA GARANTIDA!</b>\n\n🛍️ <b>{titulo}</b>\n💥 De: {preco_de}\n✅ Por: <b>{preco_por}</b> ({desconto}% de economia!)\n🚚 Frete Grátis disponível!\n\n📲 Link com desconto exclusivo:\n{link}`,
  },
];

const SAMPLE_DATA = {
  titulo: "Fritadeira Sem Óleo Air Fryer 4L Inox",
  preco_de: "R$ 399,90",
  preco_por: "R$ 219,90",
  desconto: "45",
  loja: "Shopee",
  score: "94",
  link: "https://shope.ee/exemplo",
  cupom: "SURGE40",
  parcelamento: "ou 4x de R$ 54,97 sem juros",
  frete: "Frete Grátis",
};

interface AutomationBuilderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialRule?: AutomationRule | null;
  onSaved: (rule: AutomationRule) => void;
}

export function AutomationBuilderDialog({
  open,
  onOpenChange,
  initialRule,
  onSaved,
}: AutomationBuilderDialogProps) {
  const [currentTab, setCurrentTab] = useState<string>("trigger");

  // Form State
  const [name, setName] = useState(initialRule?.name ?? "Automação Telegram — Ofertas Top");
  const [triggerType, setTriggerType] = useState<AutomationRule["trigger_type"]>(
    initialRule?.trigger_type ?? "new_offer",
  );
  const [triggerInterval, setTriggerInterval] = useState(initialRule?.trigger_interval ?? "30m");

  // Filtros
  const [minScore, setMinScore] = useState(initialRule?.min_score ?? 70);
  const [minDiscount, setMinDiscount] = useState(initialRule?.min_discount ?? 20);
  const [minPrice, setMinPrice] = useState(initialRule?.min_price ?? 10);
  const [maxPrice, setMaxPrice] = useState(initialRule?.max_price ?? 5000);
  const [minCommission, setMinCommission] = useState(initialRule?.min_commission ?? 3);
  const [marketplaces, setMarketplaces] = useState<string[]>(
    initialRule?.marketplaces ?? ["shopee", "mercadolivre", "amazon"],
  );
  const [categories, setCategories] = useState<string[]>(
    initialRule?.categories ?? ["eletronicos", "casa", "moda", "beleza"],
  );
  const [blockedWords, setBlockedWords] = useState(initialRule?.blocked_words ?? "réplica, usado, defeito");
  const [onlyFreeShipping, setOnlyFreeShipping] = useState(initialRule?.only_free_shipping ?? false);
  const [onlyWithCoupon, setOnlyWithCoupon] = useState(initialRule?.only_with_coupon ?? false);

  // Ação & Copy
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>(initialRule?.group_ids ?? []);
  const [copyTemplateId, setCopyTemplateId] = useState(initialRule?.copy_template_id ?? "urgency");
  const [customCopy, setCustomCopy] = useState(
    initialRule?.custom_copy ?? COPY_TEMPLATES[0]?.text ?? "",
  );

  // Limites
  const [intervalMinutes, setIntervalMinutes] = useState(initialRule?.interval_minutes ?? 20);
  const [dailyLimit, setDailyLimit] = useState(initialRule?.daily_limit ?? 30);
  const [startHour, setStartHour] = useState(initialRule?.start_hour ?? "08:00");
  const [endHour, setEndHour] = useState(initialRule?.end_hour ?? "22:00");
  const [activeDays, setActiveDays] = useState<string[]>(
    initialRule?.active_days ?? ["seg", "ter", "qua", "qui", "sex", "sab", "dom"],
  );
  const [actionMode, setActionMode] = useState<AutomationRule["action_mode"]>(
    initialRule?.action_mode ?? "auto_publish",
  );

  // Grupos do Supabase
  const { data: groups = [] } = useQuery({
    queryKey: ["groups"],
    queryFn: async () => {
      const { data } = await supabase.from("groups").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const sendTelegramFn = useServerFn(sendTelegramMessage);

  // Formatted preview of the copy
  const renderedPreview = useMemo(() => {
    let result = customCopy;
    result = result.replace(/\{titulo\}/g, SAMPLE_DATA.titulo);
    result = result.replace(/\{preco_de\}/g, SAMPLE_DATA.preco_de);
    result = result.replace(/\{preco_por\}/g, SAMPLE_DATA.preco_por);
    result = result.replace(/\{desconto\}/g, SAMPLE_DATA.desconto);
    result = result.replace(/\{loja\}/g, SAMPLE_DATA.loja);
    result = result.replace(/\{score\}/g, SAMPLE_DATA.score);
    result = result.replace(/\{link\}/g, SAMPLE_DATA.link);
    result = result.replace(/\{cupom\}/g, SAMPLE_DATA.cupom);
    result = result.replace(/\{parcelamento\}/g, SAMPLE_DATA.parcelamento);
    result = result.replace(/\{frete\}/g, SAMPLE_DATA.frete);
    return result;
  }, [customCopy]);

  const insertTag = (tag: string) => {
    setCustomCopy((prev) => `${prev} {${tag}}`);
  };

  const handleTemplateChange = (templateId: string) => {
    setCopyTemplateId(templateId);
    const found = COPY_TEMPLATES.find((t) => t.id === templateId);
    if (found) {
      setCustomCopy(found.text);
    }
  };

  const toggleMarketplace = (slug: string) => {
    setMarketplaces((prev) =>
      prev.includes(slug) ? prev.filter((m) => m !== slug) : [...prev, slug],
    );
  };

  const toggleGroup = (id: string) => {
    setSelectedGroupIds((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id],
    );
  };

  const toggleDay = (day: string) => {
    setActiveDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  };

  const handleSave = () => {
    if (!name.trim()) {
      toast.error("Dê um nome para a regra de automação.");
      return;
    }
    if (selectedGroupIds.length === 0 && groups.length > 0) {
      toast.warning("Selecione pelo menos um grupo do Telegram como destino.");
    }

    const rule: AutomationRule = {
      id: initialRule?.id ?? "",
      name: name.trim(),
      enabled: initialRule?.enabled ?? true,
      trigger_type: triggerType,
      trigger_interval: triggerInterval,
      min_score: minScore,
      min_discount: minDiscount,
      min_price: minPrice,
      max_price: maxPrice,
      min_commission: minCommission,
      marketplaces,
      categories,
      blocked_words: blockedWords,
      only_free_shipping: onlyFreeShipping,
      only_with_coupon: onlyWithCoupon,
      group_ids: selectedGroupIds,
      copy_template_id: copyTemplateId,
      custom_copy: customCopy,
      interval_minutes: intervalMinutes,
      daily_limit: dailyLimit,
      start_hour: startHour,
      end_hour: endHour,
      active_days: activeDays,
      action_mode: actionMode,
      today_sent_count: initialRule?.today_sent_count ?? 0,
    };

    onSaved(rule);
    toast.success("Automação salva com sucesso!");
    onOpenChange(false);
  };

  const handleTestSend = async () => {
    if (selectedGroupIds.length === 0) {
      toast.error("Selecione ao menos um grupo do Telegram antes de testar.");
      return;
    }
    const targetGroupId = selectedGroupIds[0];
    try {
      toast.loading("Enviando copy de teste para o Telegram...", { id: "test-send" });
      const res = await sendTelegramFn({
        data: {
          groupId: targetGroupId,
          text: renderedPreview,
        },
      });
      if (res.ok) {
        toast.success("Teste enviado com sucesso para o Telegram!", { id: "test-send" });
      } else {
        toast.error(res.message, { id: "test-send" });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao enviar teste.", { id: "test-send" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Zap className="size-5 text-amber-500" />
            {initialRule ? "Editar Regra de Automação" : "Nova Regra de Automação"}
          </DialogTitle>
          <DialogDescription>
            Configure os 4 passos da automação: Gatilho, Filtros, Estrutura de Copy e Limites de Publicação.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-1">
            <Label htmlFor="auto-name" className="text-xs font-semibold">Nome da Automação</Label>
            <Input
              id="auto-name"
              value={name}
              placeholder="Ex: Disparo Shopee Melhores Ofertas"
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <Tabs value={currentTab} onValueChange={setCurrentTab} className="w-full">
            <TabsList className="grid grid-cols-4 w-full h-auto p-1 bg-muted/70">
              <TabsTrigger value="trigger" className="gap-1.5 py-2 text-xs">
                <Zap className="size-3.5 text-amber-500" />
                1. Gatilho
              </TabsTrigger>
              <TabsTrigger value="filters" className="gap-1.5 py-2 text-xs">
                <Filter className="size-3.5 text-primary" />
                2. Filtros
              </TabsTrigger>
              <TabsTrigger value="copy" className="gap-1.5 py-2 text-xs">
                <FileText className="size-3.5 text-sky-500" />
                3. Copy & Grupos
              </TabsTrigger>
              <TabsTrigger value="limits" className="gap-1.5 py-2 text-xs">
                <Clock className="size-3.5 text-emerald-500" />
                4. Limites
              </TabsTrigger>
            </TabsList>

            {/* STEP 1: GATILHOS */}
            <TabsContent value="trigger" className="space-y-4 pt-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div
                  onClick={() => setTriggerType("new_offer")}
                  className={`cursor-pointer rounded-xl border p-4 transition-all ${
                    triggerType === "new_offer"
                      ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                      : "border-border bg-card hover:border-primary/40"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Sparkles className="size-4 text-primary" />
                    <h4 className="text-sm font-semibold text-foreground">Nova Oferta Capturada</h4>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Dispara assim que uma nova oferta com alto score for encontrada nas lojas parceiras.
                  </p>
                </div>

                <div
                  onClick={() => setTriggerType("price_drop")}
                  className={`cursor-pointer rounded-xl border p-4 transition-all ${
                    triggerType === "price_drop"
                      ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                      : "border-border bg-card hover:border-primary/40"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Flame className="size-4 text-rose-500" />
                    <h4 className="text-sm font-semibold text-foreground">Queda de Preço Detectada</h4>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Dispara quando um produto monitorado tiver redução repentina no valor (ex: &gt; 20% OFF).
                  </p>
                </div>

                <div
                  onClick={() => setTriggerType("top_sellers")}
                  className={`cursor-pointer rounded-xl border p-4 transition-all ${
                    triggerType === "top_sellers"
                      ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                      : "border-border bg-card hover:border-primary/40"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <ShoppingBag className="size-4 text-amber-500" />
                    <h4 className="text-sm font-semibold text-foreground">Top Mais Vendidos Shopee & Lojas</h4>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Dispara automaticamente os produtos campeões de vendas e conversão das lojas.
                  </p>
                </div>

                <div
                  onClick={() => setTriggerType("scheduled")}
                  className={`cursor-pointer rounded-xl border p-4 transition-all ${
                    triggerType === "scheduled"
                      ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                      : "border-border bg-card hover:border-primary/40"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Clock className="size-4 text-emerald-500" />
                    <h4 className="text-sm font-semibold text-foreground">Horário Agendado / Recorrente</h4>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Envia em intervalos regulares selecionando as melhores ofertas do momento.
                  </p>
                </div>
              </div>

              {triggerType === "scheduled" && (
                <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-2">
                  <Label className="text-xs font-semibold">Intervalo de Recorrência</Label>
                  <Select value={triggerInterval} onValueChange={setTriggerInterval}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15m">A cada 15 minutos</SelectItem>
                      <SelectItem value="30m">A cada 30 minutos</SelectItem>
                      <SelectItem value="1h">A cada 1 hora</SelectItem>
                      <SelectItem value="2h">A cada 2 horas</SelectItem>
                      <SelectItem value="4h">A cada 4 horas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </TabsContent>

            {/* STEP 2: FILTROS */}
            <TabsContent value="filters" className="space-y-4 pt-3">
              <div className="grid gap-4 sm:grid-cols-2">
                {/* Score Mínimo */}
                <div className="rounded-xl border border-border bg-card p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">Oferta Score Mínimo</Label>
                    <Badge variant="secondary" className="font-mono text-xs">{minScore} pts</Badge>
                  </div>
                  <Slider
                    value={[minScore]}
                    onValueChange={([v]) => setMinScore(v ?? 0)}
                    min={0}
                    max={100}
                    step={5}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Apenas ofertas com pontuação calculada acima deste valor serão enviadas.
                  </p>
                </div>

                {/* Desconto Mínimo */}
                <div className="rounded-xl border border-border bg-card p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">Desconto Mínimo</Label>
                    <Badge variant="secondary" className="font-mono text-xs">{minDiscount}% OFF</Badge>
                  </div>
                  <Slider
                    value={[minDiscount]}
                    onValueChange={([v]) => setMinDiscount(v ?? 0)}
                    min={0}
                    max={90}
                    step={5}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Ignora produtos com desconto inferior a {minDiscount}%.
                  </p>
                </div>

                {/* Faixa de Preço */}
                <div className="rounded-xl border border-border bg-card p-3 space-y-2">
                  <Label className="text-xs font-semibold">Faixa de Preço (R$)</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-muted-foreground">Mínimo</span>
                      <Input
                        type="number"
                        min={0}
                        value={minPrice}
                        onChange={(e) => setMinPrice(Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground">Máximo</span>
                      <Input
                        type="number"
                        min={0}
                        value={maxPrice}
                        onChange={(e) => setMaxPrice(Number(e.target.value))}
                      />
                    </div>
                  </div>
                </div>

                {/* Comissão Mínima */}
                <div className="rounded-xl border border-border bg-card p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">Comissão Mínima Afiliado</Label>
                    <Badge variant="secondary" className="font-mono text-xs">{minCommission}%</Badge>
                  </div>
                  <Slider
                    value={[minCommission]}
                    onValueChange={([v]) => setMinCommission(v ?? 0)}
                    min={0}
                    max={30}
                    step={1}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Garante retorno financeiro por publicação.
                  </p>
                </div>
              </div>

              {/* Lojas Parceiras */}
              <div className="rounded-xl border border-border bg-card p-3 space-y-2">
                <Label className="text-xs font-semibold">Lojas Parceiras Permitidas</Label>
                <div className="flex flex-wrap gap-2 pt-1">
                  {[
                    { id: "shopee", name: "Shopee" },
                    { id: "mercadolivre", name: "Mercado Livre" },
                    { id: "amazon", name: "Amazon" },
                    { id: "shein", name: "SHEIN" },
                  ].map((store) => (
                    <button
                      key={store.id}
                      type="button"
                      onClick={() => toggleMarketplace(store.id)}
                      className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                        marketplaces.includes(store.id)
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-muted text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <CheckCircle2 className={`size-3.5 ${marketplaces.includes(store.id) ? "opacity-100" : "opacity-0"}`} />
                      {store.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Palavras Bloqueadas */}
              <div className="space-y-1">
                <Label htmlFor="blocked" className="text-xs font-semibold">
                  Palavras Bloqueadas / Blacklist (separadas por vírgula)
                </Label>
                <Input
                  id="blocked"
                  value={blockedWords}
                  placeholder="Ex: réplica, usado, defeito, avaria"
                  onChange={(e) => setBlockedWords(e.target.value)}
                />
              </div>

              <div className="flex flex-wrap gap-4 pt-1">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="free-shipping"
                    checked={onlyFreeShipping}
                    onCheckedChange={(c) => setOnlyFreeShipping(Boolean(c))}
                  />
                  <label htmlFor="free-shipping" className="text-xs cursor-pointer">
                    Apenas com Frete Grátis
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="with-coupon"
                    checked={onlyWithCoupon}
                    onCheckedChange={(c) => setOnlyWithCoupon(Boolean(c))}
                  />
                  <label htmlFor="with-coupon" className="text-xs cursor-pointer">
                    Apenas com Cupom de Desconto
                  </label>
                </div>
              </div>
            </TabsContent>

            {/* STEP 3: COPY & GRUPOS DO TELEGRAM */}
            <TabsContent value="copy" className="space-y-4 pt-3">
              {/* Seleção de Grupos de Destino */}
              <div className="rounded-xl border border-border bg-card p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <Send className="size-3.5 text-sky-500" />
                    Grupos e Canais de Destino do Telegram
                  </Label>
                  <span className="text-[11px] text-muted-foreground">
                    {selectedGroupIds.length} selecionado(s)
                  </span>
                </div>

                {groups.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">
                    Nenhum grupo cadastrado. Use a tela de Grupos para conectar o Telegram via QR Code.
                  </p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2 max-h-36 overflow-y-auto p-1">
                    {groups.map((g) => (
                      <div
                        key={g.id}
                        onClick={() => toggleGroup(g.id)}
                        className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer text-xs transition-colors ${
                          selectedGroupIds.includes(g.id)
                            ? "border-sky-500 bg-sky-500/10 text-sky-950 dark:text-sky-100"
                            : "border-border bg-muted/40 hover:bg-muted"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Checkbox checked={selectedGroupIds.includes(g.id)} />
                          <span className="font-medium">{g.name}</span>
                        </div>
                        <Badge variant="outline" className="text-[10px]">
                          {g.platform}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Modelos de Estrutura de Copy */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Modelo de Estrutura de Copy</Label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {COPY_TEMPLATES.map((tmpl) => (
                    <Button
                      key={tmpl.id}
                      type="button"
                      size="sm"
                      variant={copyTemplateId === tmpl.id ? "default" : "outline"}
                      className="text-xs h-auto py-2 justify-start truncate"
                      onClick={() => handleTemplateChange(tmpl.id)}
                    >
                      {tmpl.name}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Tags rápidas */}
              <div className="space-y-1">
                <span className="text-[11px] text-muted-foreground">Inserir tags inteligentes:</span>
                <div className="flex flex-wrap gap-1">
                  {[
                    "titulo",
                    "preco_de",
                    "preco_por",
                    "desconto",
                    "link",
                    "cupom",
                    "loja",
                    "score",
                    "parcelamento",
                    "frete",
                  ].map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => insertTag(tag)}
                      className="rounded bg-muted px-2 py-0.5 text-[11px] font-mono text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
                    >
                      +{`{${tag}}`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Editor + Live Preview */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="custom-copy" className="text-xs font-semibold">
                    Texto da Copy (HTML Telegram)
                  </Label>
                  <textarea
                    id="custom-copy"
                    rows={8}
                    value={customCopy}
                    onChange={(e) => setCustomCopy(e.target.value)}
                    className="w-full rounded-md border border-input bg-background p-2.5 text-xs font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">Prévia no Telegram</Label>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-6 text-[11px] gap-1 text-sky-600 hover:text-sky-700"
                      onClick={handleTestSend}
                    >
                      <Send className="size-3" />
                      Testar Envio
                    </Button>
                  </div>
                  <div
                    className="h-[170px] overflow-y-auto rounded-md border border-border bg-sky-950/10 dark:bg-sky-950/30 p-3 text-xs leading-relaxed text-foreground whitespace-pre-wrap font-sans"
                    dangerouslySetInnerHTML={{ __html: renderedPreview }}
                  />
                </div>
              </div>
            </TabsContent>

            {/* STEP 4: LIMITES & HORÁRIOS */}
            <TabsContent value="limits" className="space-y-4 pt-3">
              <div className="grid gap-4 sm:grid-cols-2">
                {/* Intervalo entre Disparos */}
                <div className="rounded-xl border border-border bg-card p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">Intervalo Mínimo Entre Envios</Label>
                    <Badge variant="secondary" className="font-mono text-xs">{intervalMinutes} minutos</Badge>
                  </div>
                  <Slider
                    value={[intervalMinutes]}
                    onValueChange={([v]) => setIntervalMinutes(v ?? 15)}
                    min={5}
                    max={180}
                    step={5}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Evita flood e mantém a audiência engajada sem poluição no canal.
                  </p>
                </div>

                {/* Limite Diário */}
                <div className="rounded-xl border border-border bg-card p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">Limite Diário de Publicações</Label>
                    <Badge variant="secondary" className="font-mono text-xs">{dailyLimit} posts/dia</Badge>
                  </div>
                  <Slider
                    value={[dailyLimit]}
                    onValueChange={([v]) => setDailyLimit(v ?? 20)}
                    min={5}
                    max={100}
                    step={5}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Teto máximo de ofertas enviadas por grupo por dia.
                  </p>
                </div>
              </div>

              {/* Janela de Horário */}
              <div className="rounded-xl border border-border bg-card p-3 space-y-2">
                <Label className="text-xs font-semibold">Janela de Horário Permitida para Publicação</Label>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">De:</span>
                    <Input
                      type="time"
                      value={startHour}
                      onChange={(e) => setStartHour(e.target.value)}
                      className="w-28 text-xs"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Até:</span>
                    <Input
                      type="time"
                      value={endHour}
                      onChange={(e) => setEndHour(e.target.value)}
                      className="w-28 text-xs"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Ofertas capturadas fora dessa janela aguardam na fila até o próximo horário permitido.
                </p>
              </div>

              {/* Dias da Semana */}
              <div className="rounded-xl border border-border bg-card p-3 space-y-2">
                <Label className="text-xs font-semibold">Dias da Semana Ativos</Label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { id: "seg", label: "Segunda" },
                    { id: "ter", label: "Terça" },
                    { id: "qua", label: "Quarta" },
                    { id: "qui", label: "Quinta" },
                    { id: "sex", label: "Sexta" },
                    { id: "sab", label: "Sábado" },
                    { id: "dom", label: "Domingo" },
                  ].map((day) => (
                    <button
                      key={day.id}
                      type="button"
                      onClick={() => toggleDay(day.id)}
                      className={`rounded-lg border px-3 py-1 text-xs font-medium transition-colors ${
                        activeDays.includes(day.id)
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-muted text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Modo de Ação */}
              <div className="rounded-xl border border-border bg-card p-3 space-y-2">
                <Label className="text-xs font-semibold">Modo de Publicação</Label>
                <div className="grid grid-cols-2 gap-2">
                  <div
                    onClick={() => setActionMode("auto_publish")}
                    className={`cursor-pointer rounded-lg border p-3 text-xs transition-colors ${
                      actionMode === "auto_publish"
                        ? "border-primary bg-primary/10 font-semibold text-primary"
                        : "border-border bg-muted/30 text-muted-foreground"
                    }`}
                  >
                    🚀 Publicar Direto no Telegram
                  </div>
                  <div
                    onClick={() => setActionMode("queue_for_review")}
                    className={`cursor-pointer rounded-lg border p-3 text-xs transition-colors ${
                      actionMode === "queue_for_review"
                        ? "border-primary bg-primary/10 font-semibold text-primary"
                        : "border-border bg-muted/30 text-muted-foreground"
                    }`}
                  >
                    📋 Enfileirar para Aprovação Manual
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} className="gap-2">
            <Zap className="size-4" />
            Salvar e Ativar Automação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
