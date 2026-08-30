import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Settings, Save, CheckCircle2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import type { WhatsAppGroupDto } from "@/lib/whatsapp/types";
import { updateWhatsAppGroupConfig } from "@/lib/whatsapp/whatsapp.functions";
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

interface GroupConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: WhatsAppGroupDto | null;
}

export function GroupConfigDialog({
  open,
  onOpenChange,
  group,
}: GroupConfigDialogProps) {
  const qc = useQueryClient();
  const updateConfigFn = useServerFn(updateWhatsAppGroupConfig);

  const [isActive, setIsActive] = useState(true);
  const [isSelected, setIsSelected] = useState(true);
  const [minScore, setMinScore] = useState(80);
  const [minDiscount, setMinDiscount] = useState(30);
  const [dailyLimit, setDailyLimit] = useState(10);
  const [intervalMinutes, setIntervalMinutes] = useState(30);
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("22:00");
  const [marketplaces, setMarketplaces] = useState<string[]>([
    "shopee",
    "mercadolivre",
    "amazon",
    "shein",
  ]);
  const [categories, setCategories] = useState<string[]>([
    "casa",
    "beleza",
    "eletronicos",
    "moda",
    "esportes",
  ]);
  const [copyTemplate, setCopyTemplate] = useState<string>("urgency");

  useEffect(() => {
    if (group) {
      setIsActive(group.is_active ?? true);
      setIsSelected(group.is_selected ?? true);
      setMinScore(group.minimum_offer_score ?? 80);
      setMinDiscount(group.minimum_discount ?? 30);
      setDailyLimit(group.daily_limit ?? 10);
      setIntervalMinutes(group.posting_interval_minutes ?? 30);
      setStartTime(group.allowed_start_time ?? "08:00");
      setEndTime(group.allowed_end_time ?? "22:00");
      setMarketplaces(
        group.allowed_marketplaces ?? ["shopee", "mercadolivre", "amazon", "shein"],
      );
      setCategories(
        group.allowed_categories ?? [
          "casa",
          "beleza",
          "eletronicos",
          "moda",
          "esportes",
        ],
      );
      setCopyTemplate(group.copy_template ?? "urgency");
    }
  }, [group]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!group) return;
      return updateConfigFn({
        data: {
          groupId: group.id,
          is_active: isActive,
          is_selected: isSelected,
          minimum_offer_score: minScore,
          minimum_discount: minDiscount,
          daily_limit: dailyLimit,
          posting_interval_minutes: intervalMinutes,
          allowed_start_time: startTime,
          allowed_end_time: endTime,
          allowed_marketplaces: marketplaces,
          allowed_categories: categories,
          copy_template: copyTemplate,
        },
      });
    },
    onSuccess: () => {
      toast.success("Configurações do grupo salvas com sucesso!");
      qc.invalidateQueries({ queryKey: ["whatsapp-groups"] });
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao salvar configurações."),
  });

  const toggleMarketplace = (m: string) => {
    setMarketplaces((prev) =>
      prev.includes(m) ? prev.filter((item) => item !== m) : [...prev, m],
    );
  };

  const toggleCategory = (c: string) => {
    setCategories((prev) =>
      prev.includes(c) ? prev.filter((item) => item !== c) : [...prev, c],
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Settings className="size-4 text-emerald-600" />
            Configurações do Grupo: {group?.name}
          </DialogTitle>
          <DialogDescription>
            Ajuste regras exclusivas de publicação, horários, score e limites para este canal.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          {/* Toggles principais */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-center justify-between rounded-xl border border-border bg-card p-3">
              <div>
                <Label className="text-xs font-semibold">Grupo Ativo</Label>
                <p className="text-[11px] text-muted-foreground">Habilitar postagens neste grupo</p>
              </div>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border bg-card p-3">
              <div>
                <Label className="text-xs font-semibold">Receber Ofertas Automaticamente</Label>
                <p className="text-[11px] text-muted-foreground">Incluir na rotação do motor</p>
              </div>
              <Switch checked={isSelected} onCheckedChange={setIsSelected} />
            </div>
          </div>

          {/* Sliders: Score e Desconto */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-3 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Score Mínimo da Oferta</Label>
                <Badge variant="secondary" className="font-mono text-xs">{minScore} pts</Badge>
              </div>
              <Slider
                value={[minScore]}
                onValueChange={([v]) => setMinScore(v ?? 80)}
                min={0}
                max={100}
                step={5}
              />
              <p className="text-[10px] text-muted-foreground">Recomendado: 80+ para grupos VIP</p>
            </div>

            <div className="rounded-xl border border-border bg-card p-3 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Desconto Mínimo</Label>
                <Badge variant="secondary" className="font-mono text-xs">{minDiscount}% OFF</Badge>
              </div>
              <Slider
                value={[minDiscount]}
                onValueChange={([v]) => setMinDiscount(v ?? 30)}
                min={0}
                max={90}
                step={5}
              />
              <p className="text-[10px] text-muted-foreground">Ignora produtos com desconto menor</p>
            </div>
          </div>

          {/* Limites e Intervalos */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-3 space-y-1.5">
              <Label htmlFor="g-limit" className="text-xs font-semibold">Limite Diário (mensagens)</Label>
              <Input
                id="g-limit"
                type="number"
                min={1}
                max={100}
                value={dailyLimit}
                onChange={(e) => setDailyLimit(Number(e.target.value))}
                className="h-8 text-xs"
              />
            </div>

            <div className="rounded-xl border border-border bg-card p-3 space-y-1.5">
              <Label htmlFor="g-int" className="text-xs font-semibold">Intervalo Entre Envios (minutos)</Label>
              <Input
                id="g-int"
                type="number"
                min={5}
                max={180}
                value={intervalMinutes}
                onChange={(e) => setIntervalMinutes(Number(e.target.value))}
                className="h-8 text-xs"
              />
            </div>
          </div>

          {/* Horário Permitido */}
          <div className="rounded-xl border border-border bg-card p-3 space-y-2">
            <Label className="text-xs font-semibold">Janela de Horário Permitida</Label>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Início:</span>
                <Input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="h-8 w-28 text-xs"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Fim:</span>
                <Input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="h-8 w-28 text-xs"
                />
              </div>
            </div>
          </div>

          {/* Marketplaces Permitidos */}
          <div className="rounded-xl border border-border bg-card p-3 space-y-2">
            <Label className="text-xs font-semibold">Marketplaces Permitidos</Label>
            <div className="flex flex-wrap gap-2 pt-1">
              {[
                { id: "shopee", name: "Shopee" },
                { id: "mercadolivre", name: "Mercado Livre" },
                { id: "amazon", name: "Amazon" },
                { id: "shein", name: "SHEIN" },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggleMarketplace(m.id)}
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                    marketplaces.includes(m.id)
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : "border-border bg-muted text-muted-foreground"
                  }`}
                >
                  <CheckCircle2 className={`size-3.5 ${marketplaces.includes(m.id) ? "opacity-100" : "opacity-0"}`} />
                  {m.name}
                </button>
              ))}
            </div>
          </div>

          {/* Categorias Permitidas */}
          <div className="rounded-xl border border-border bg-card p-3 space-y-2">
            <Label className="text-xs font-semibold">Categorias Permitidas</Label>
            <div className="flex flex-wrap gap-2 pt-1">
              {[
                { id: "casa", name: "Casa" },
                { id: "beleza", name: "Beleza" },
                { id: "eletronicos", name: "Eletrônicos" },
                { id: "moda", name: "Moda" },
                { id: "esportes", name: "Esportes" },
              ].map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggleCategory(c.id)}
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                    categories.includes(c.id)
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : "border-border bg-muted text-muted-foreground"
                  }`}
                >
                  <CheckCircle2 className={`size-3.5 ${categories.includes(c.id) ? "opacity-100" : "opacity-0"}`} />
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          {/* Template de Copy */}
          <div className="rounded-xl border border-border bg-card p-3 space-y-1.5">
            <Label className="text-xs font-semibold">Modelo de Template de Copy</Label>
            <Select value={copyTemplate} onValueChange={setCopyTemplate}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="urgency">🔥 Urgência / Mega Oferta</SelectItem>
                <SelectItem value="direct">⚡ Direto ao Ponto</SelectItem>
                <SelectItem value="coupon">🏷️ Com Cupom de Desconto</SelectItem>
                <SelectItem value="savings">💰 Economia Máxima / Cashback</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Save className="size-3.5" />
            {saveMutation.isPending ? "Salvando..." : "Salvar Configurações"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
