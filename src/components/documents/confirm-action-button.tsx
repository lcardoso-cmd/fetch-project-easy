import { useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Botão de ação de leitura que sempre pede confirmação antes de executar.
 * A ação confirmada é destacada em vermelho, por ser irreversível na fila.
 */
export function ConfirmActionButton({
  label,
  ariaLabel,
  icon,
  variant = "outline",
  className,
  loading = false,
  disabled = false,
  disabledHint,
  title,
  description,
  confirmLabel,
  onConfirm,
}: {
  label: string;
  ariaLabel?: string;
  icon?: ReactNode;
  variant?: "outline" | "ghost" | "secondary";
  className?: string;
  loading?: boolean;
  disabled?: boolean;
  disabledHint?: string;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
}) {
  const [open, setOpen] = useState(false);
  const isDisabled = disabled || loading;

  const trigger = (
    <Button
      type="button"
      variant={variant}
      size="sm"
      className={className}
      aria-label={ariaLabel ?? label}
      disabled={isDisabled}
      onClick={() => setOpen(true)}
    >
      {loading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : icon}
      {label}
    </Button>
  );

  return (
    <>
      {disabled && disabledHint ? (
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex">{trigger}</span>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p className="text-xs">{disabledHint}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        trigger
      )}

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                setOpen(false);
                onConfirm();
              }}
            >
              {confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
