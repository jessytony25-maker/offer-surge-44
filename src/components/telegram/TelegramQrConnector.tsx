import { useState } from "react";
import QRCode from "react-qr-code";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  QrCode,
  Send,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Users,
  Radio,
  Sparkles,
  KeyRound,
} from "lucide-react";
import { toast } from "sonner";
import {
  telegramBotStatus,
  syncTelegramGroups,
  sendTelegramMessage,
} from "@/lib/telegram.functions";
import { saveIntegration } from "@/lib/integrations.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface TelegramQrConnectorProps {
  onGroupsUpdated?: () => void;
}

export function TelegramQrConnector({ onGroupsUpdated }: TelegramQrConnectorProps) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [botToken, setBotToken] = useState("");

  const getStatus = useServerFn(telegramBotStatus);
  const syncGroups = useServerFn(syncTelegramGroups);
  const saveCreds = useServerFn(saveIntegration);

  const { data: status, isLoading, refetch } = useQuery({
    queryKey: ["telegram-bot-status"],
    queryFn: () => getStatus(),
  });

  const saveTokenMutation = useMutation({
    mutationFn: async (token: string) => {
      const res = await saveCreds({
        data: {
          kind: "channel",
          provider: "telegram",
          credentials: { bot_token: token.trim() },
        },
      });
      return res;
    },
    onSuccess: async (res) => {
      if (res.status === "connected") {
        toast.success("Bot do Telegram conectado com sucesso!");
        await refetch();
        qc.invalidateQueries({ queryKey: ["groups"] });
        qc.invalidateQueries({ queryKey: ["integrations"] });
      } else {
        toast.error(res.message || "Erro ao validar o token.");
      }
    },
    onError: () => toast.error("Falha ao salvar token."),
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await syncGroups();
      return res;
    },
    onSuccess: (res) => {
      toast.success(
        `Sincronização concluída! ${res.found} destinos encontrados (${res.imported} novos, ${res.updated} atualizados).`,
      );
      qc.invalidateQueries({ queryKey: ["groups"] });
      if (onGroupsUpdated) onGroupsUpdated();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao sincronizar grupos."),
  });

  // URL para adicionar aos grupos via QR
  const qrTargetUrl = status?.connected && status.username
    ? `https://t.me/${status.username}?startgroup=true`
    : "https://t.me/BotFather";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 border-primary/40 bg-primary/5 hover:bg-primary/10 text-primary">
          <QrCode className="size-4" />
          Conectar Telegram via QR Code
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="size-5 text-sky-500" />
            Conectar Telegram via QR Code & Sincronizar Grupos
          </DialogTitle>
          <DialogDescription>
            Conecte seu bot oficial do Telegram, escaneie o QR code para adicioná-lo aos seus grupos e canais, e importe todos os destinos automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Status Bar */}
          <div className="flex items-center justify-between rounded-xl border border-border bg-card p-3">
            <div className="flex items-center gap-3">
              <div className={`flex size-8 items-center justify-center rounded-full ${status?.connected ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"}`}>
                {status?.connected ? <CheckCircle2 className="size-5" /> : <AlertCircle className="size-5" />}
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {status?.connected ? `Bot Conectado: @${status.username}` : "Bot não conectado"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {status?.connected
                    ? "Pronto para enviar ofertas aos grupos e canais vinculados."
                    : status?.message || "Informe o Bot Token do BotFather para gerar seu QR code."}
                </p>
              </div>
            </div>
            {status?.connected && (
              <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600">
                Ativo
              </Badge>
            )}
          </div>

          <Tabs defaultValue={status?.connected ? "qrcode" : "token"} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="qrcode" className="gap-2">
                <QrCode className="size-4" />
                QR Code dos Grupos
              </TabsTrigger>
              <TabsTrigger value="token" className="gap-2">
                <KeyRound className="size-4" />
                Configurar Bot Token
              </TabsTrigger>
            </TabsList>

            {/* TAB: QR CODE */}
            <TabsContent value="qrcode" className="space-y-4 pt-3">
              {status?.connected ? (
                <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-muted/20 p-5 text-center">
                  <div className="rounded-xl border-4 border-white bg-white p-3 shadow-md">
                    <QRCode
                      value={qrTargetUrl}
                      size={180}
                      level="M"
                      className="size-44"
                    />
                  </div>

                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">
                      Escaneie com a câmera do seu celular
                    </p>
                    <p className="text-xs text-muted-foreground max-w-sm">
                      O Telegram abrirá a tela para você escolher em quais grupos ou canais deseja adicionar o bot <strong>@{status.username}</strong> com permissão de postar mensagens.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                      className="gap-1.5"
                    >
                      <a href={status.addToGroupUrl} target="_blank" rel="noreferrer">
                        <Users className="size-3.5" />
                        Adicionar em Grupo
                        <ExternalLink className="size-3 ml-0.5 opacity-60" />
                      </a>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                      className="gap-1.5"
                    >
                      <a href={status.addToChannelUrl} target="_blank" rel="noreferrer">
                        <Radio className="size-3.5" />
                        Adicionar em Canal
                        <ExternalLink className="size-3 ml-0.5 opacity-60" />
                      </a>
                    </Button>
                  </div>

                  <div className="w-full border-t border-border pt-4 mt-1">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                      <div className="text-left">
                        <p className="text-xs font-semibold text-foreground">
                          Já adicionou o bot no seu grupo/canal?
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Clique no botão para ler todos os grupos e abrir a lista automaticamente.
                        </p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => syncMutation.mutate()}
                        disabled={syncMutation.isPending}
                        className="gap-2 w-full sm:w-auto shrink-0"
                      >
                        <RefreshCw className={`size-3.5 ${syncMutation.isPending ? "animate-spin" : ""}`} />
                        {syncMutation.isPending ? "Sincronizando..." : "Sincronizar Grupos Agora"}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border p-6 text-center space-y-3">
                  <AlertCircle className="size-8 mx-auto text-amber-500" />
                  <p className="text-sm font-medium text-foreground">
                    Para gerar o QR Code personalizado, informe o Bot Token primeiro na aba ao lado.
                  </p>
                  <p className="text-xs text-muted-foreground max-w-md mx-auto">
                    Você pode criar um bot gratuito em menos de 1 minuto conversando com o @BotFather no Telegram.
                  </p>
                </div>
              )}
            </TabsContent>

            {/* TAB: TOKEN */}
            <TabsContent value="token" className="space-y-4 pt-3">
              <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="token-input" className="text-xs font-semibold">
                    Bot Token do Telegram
                  </Label>
                  <Input
                    id="token-input"
                    type="password"
                    placeholder="123456789:ABCdefGHIjklMNOpqrSTUvwxYZ"
                    value={botToken}
                    onChange={(e) => setBotToken(e.target.value)}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Obtido gratuitamente ao criar um bot no Telegram com o <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="text-primary underline">@BotFather</a>.
                  </p>
                </div>

                <div className="rounded-lg bg-muted/40 p-3 text-xs space-y-1.5 text-muted-foreground">
                  <p className="font-semibold text-foreground flex items-center gap-1.5">
                    <Sparkles className="size-3.5 text-primary" /> Passo a passo rápido:
                  </p>
                  <ol className="list-decimal list-inside space-y-0.5 text-[11px]">
                    <li>Abra o Telegram e pesquise por <strong>@BotFather</strong></li>
                    <li>Envie o comando <code>/newbot</code> e escolha o nome</li>
                    <li>Copie o token gerado (ex: <code>123456:ABC...</code>) e cole acima</li>
                    <li>Clique em "Salvar e Conectar Bot"</li>
                  </ol>
                </div>

                <Button
                  className="w-full gap-2"
                  disabled={!botToken.trim() || saveTokenMutation.isPending}
                  onClick={() => saveTokenMutation.mutate(botToken)}
                >
                  {saveTokenMutation.isPending ? "Conectando..." : "Salvar e Conectar Bot"}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
