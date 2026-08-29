import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

/**
 * Envia a mensagem pronta para a fila de publicação.
 * Telegram: publicação automática pelo bot. WhatsApp: modo copiar e publicar.
 */
export function PublishDialog({ message }: { message: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [groupId, setGroupId] = useState<string>("");
  const [content, setContent] = useState(message);

  const { data: groups = [] } = useQuery({
    queryKey: ["groups"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("groups")
        .select("id, name, platform")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const enqueue = useMutation({
    mutationFn: async () => {
      if (!groupId) throw new Error("Escolha um grupo de destino");
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Sessão expirada");
      const { error } = await supabase.from("publication_queue").insert({
        user_id: userId,
        group_id: groupId,
        content,
        status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Enviada para a fila de publicação");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["publication_queue"] });
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Não foi possível enfileirar"),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) setContent(message);
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" className="flex-1 gap-1">
          <Send className="size-3.5" /> Publicar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enviar para a fila</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Grupo de destino</Label>
            {groups.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Nenhum grupo cadastrado. Crie um em Grupos.
              </p>
            ) : (
              <Select value={groupId} onValueChange={setGroupId}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha o grupo" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name} · {g.platform}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pub-content">Mensagem</Label>
            <Textarea
              id="pub-content"
              className="min-h-44 font-mono text-xs"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            Telegram publica automaticamente pelo bot. WhatsApp entra em modo copiar e publicar
            na fila.
          </p>
          <Button
            className="w-full"
            onClick={() => enqueue.mutate()}
            disabled={enqueue.isPending || groups.length === 0}
          >
            {enqueue.isPending ? "Enviando..." : "Enviar para a fila"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
