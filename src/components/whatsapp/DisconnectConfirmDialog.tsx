import { AlertTriangle, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface DisconnectConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isLoading?: boolean;
}

export function DisconnectConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  isLoading,
}: DisconnectConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="size-5" />
            Desconectar Sessão do WhatsApp
          </DialogTitle>
          <DialogDescription className="text-xs pt-1 leading-relaxed">
            Tem certeza que deseja desconectar esta sessão?
            <br />
            <br />
            • As publicações ativas da fila serão pausadas.
            <br />
            • O histórico e as configurações dos seus grupos serão preservados para quando você se reconectar.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={onConfirm}
            disabled={isLoading}
            className="gap-1.5"
          >
            <LogOut className="size-3.5" />
            {isLoading ? "Desconectando..." : "Sim, Desconectar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
