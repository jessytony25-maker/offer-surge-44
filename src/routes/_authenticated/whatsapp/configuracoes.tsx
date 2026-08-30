import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Settings, ShieldCheck, Save, Clock, Copy, Sliders } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { WhatsAppNav } from "@/components/whatsapp/WhatsAppNav";
import { BRAND } from "@/lib/branding";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getWhatsAppSettings,
  updateWhatsAppSettings,
} from "@/lib/whatsapp/whatsapp.functions";

export const Route = createFileRoute("/_authenticated/whatsapp/configuracoes")({
  head: () => ({
    meta: [
      { title: `Configurações WhatsApp — ${BRAND.name}` },
      { name: "description", content: "Regras anti-duplicidade, anti-flood e políticas de envio do WhatsApp." },
      { property: "og:title", content: `Configurações WhatsApp — ${BRAND.name}` },
      { property: "og:description", content: "Regras anti-duplicidade e anti-flood." },
    ],
  }),
  component: WhatsAppConfiguracoesPage,
});

function WhatsAppConfiguracoesPage() {
  const qc = useQueryClient();
  const fetchSettingsFn = useServerFn(getWhatsAppSettings);
  const updateSettingsFn = useServerFn(updateWhatsAppSettings);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["whatsapp-settings"],
    queryFn: () => fetchSettingsFn(),
  });

  const [dupWindow, setDupWindow] = useState<number>(24);
  const [dailyLimit, setDailyLimit] = useState<number>(50);
  const [minInterval, setMinInterval] = useState<number>(15);
  const [pauseOnDisconnect, setPauseOnDisconnect] = useState<boolean>(true);

  useEffect(() => {
    if (settings) {
      setDupWindow(settings.duplicate_window_hours || 24);
      setDailyLimit(settings.global_daily_limit || 50);
      setMinInterval(settings.global_min_interval_minutes || 15);
      setPauseOnDisconnect(settings.pause_on_disconnect ?? true);
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      return updateSettingsFn({
        data: {
          duplicate_window_hours: dupWindow,
          global_daily_limit: dailyLimit,
          global_min_interval_minutes: minInterval,
          pause_on_disconnect: pauseOnDisconnect,
        },
      });
    },
    onSuccess: (res) => {
      toast.success(res.message);
      qc.invalidateQueries({ queryKey: ["whatsapp-settings"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao salvar configurações."),
  });

  return (
    <AppShell
      title="Configurações do WhatsApp"
      description="Controle de segurança anti-duplicidade, limites e proteção contra bloqueios"
    >
      <WhatsAppNav />

      <div className="max-w-2xl space-y-6">
        {/* CARD: PROTEÇÃO ANTI-DUPLICIDADE */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <Copy className="size-4 text-emerald-600" />
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Janela de Proteção Anti-Duplicidade
              </h3>
              <p className="text-xs text-muted-foreground">
                Impede que a mesma oferta seja publicada repetidamente no mesmo grupo.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold">Janela de Bloqueio de Repetição</Label>
            <Select
              value={String(dupWindow)}
              onValueChange={(v) => setDupWindow(Number(v))}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 hora</SelectItem>
                <SelectItem value="6">6 horas</SelectItem>
                <SelectItem value="12">12 horas</SelectItem>
                <SelectItem value="24">24 horas (Recomendado)</SelectItem>
                <SelectItem value="48">48 horas</SelectItem>
                <SelectItem value="168">7 dias</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              Se uma oferta for capturada novamente antes desse prazo expirar para aquele grupo, o disparo será ignorado com registro no log.
            </p>
          </div>
        </div>

        {/* CARD: LIMITES GLOBAIS ANTI-FLOOD */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <ShieldCheck className="size-4 text-emerald-600" />
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Limites Globais Anti-Flood
              </h3>
              <p className="text-xs text-muted-foreground">
                Parâmetros de proteção da conta e integridade do número.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="g-limit" className="text-xs font-semibold">Limite Global Diário (mensagens)</Label>
              <Input
                id="g-limit"
                type="number"
                min={5}
                max={500}
                value={dailyLimit}
                onChange={(e) => setDailyLimit(Number(e.target.value))}
                className="h-9 text-xs"
              />
              <p className="text-[10px] text-muted-foreground">Teto diário somando todos os grupos</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="g-int" className="text-xs font-semibold">Intervalo Mínimo Global (minutos)</Label>
              <Input
                id="g-int"
                type="number"
                min={1}
                max={180}
                value={minInterval}
                onChange={(e) => setMinInterval(Number(e.target.value))}
                className="h-9 text-xs"
              />
              <p className="text-[10px] text-muted-foreground">Pausa mínima entre postagens</p>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg bg-muted/40 p-3 mt-2">
            <div>
              <Label className="text-xs font-semibold">Pausar Publicações na Desconexão</Label>
              <p className="text-[11px] text-muted-foreground">
                Mantém as ofertas na fila sem perda quando o WhatsApp estiver offline.
              </p>
            </div>
            <Switch
              checked={pauseOnDisconnect}
              onCheckedChange={setPauseOnDisconnect}
            />
          </div>
        </div>

        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          <Save className="size-4" />
          {saveMutation.isPending ? "Salvando..." : "Salvar Configurações Globais"}
        </Button>
      </div>
    </AppShell>
  );
}
