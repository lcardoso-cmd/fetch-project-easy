import { useEffect, type ReactNode } from "react";
import { useBlocker } from "@tanstack/react-router";
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

type Options = {
  /** True quando há alterações não salvas. */
  when: boolean;
  /** Título do modal de confirmação. */
  title?: string;
  /** Mensagem exibida na confirmação de navegação interna. */
  message?: string;
  /** Rótulo do botão que confirma sair perdendo as alterações. */
  confirmLabel?: string;
  onConfirm?: () => void;
  /** Rótulo do botão que permanece na página. */
  cancelLabel?: string;
};

const DEFAULT_TITLE = "Alterações não salvas";
const DEFAULT_MESSAGE =
  "Você tem alterações não salvas. Deseja sair mesmo assim? As alterações podem ser perdidas.";
const DEFAULT_CONFIRM = "Sair sem salvar";
const DEFAULT_CANCEL = "Continuar editando";

/**
 * Bloqueia saída (fechar aba, navegar internamente) quando `when` é true,
 * pedindo confirmação ao usuário. Retorna um `dialog` que o consumidor
 * deve renderizar — trocamos `window.confirm` por um modal customizado,
 * mas mantemos `beforeunload` nativo para fechamento de aba/reload
 * (browsers exigem confirmação nativa nesse caso).
 */
export function useUnsavedChangesGuard({
  when,
  title = DEFAULT_TITLE,
  message = DEFAULT_MESSAGE,
  confirmLabel = DEFAULT_CONFIRM,
  cancelLabel = DEFAULT_CANCEL,
  onConfirm,
}: Options): { dialog: ReactNode } {
  // Fechar aba / recarregar página / navegar para outra origem — só o nativo funciona.
  useEffect(() => {
    if (!when) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = message;
      return message;
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [when, message]);

  // Navegação interna do TanStack Router: bloqueia com resolver para exibir modal.
  const blocker = useBlocker({
    shouldBlockFn: () => when,
    withResolver: true,
    enableBeforeUnload: false,
  });

  const open = blocker.status === "blocked";

  const dialog = (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next && blocker.status === "blocked") blocker.reset();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{message}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            onClick={() => {
              if (blocker.status === "blocked") blocker.reset();
            }}
          >
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              onConfirm?.();
              if (blocker.status === "blocked") blocker.proceed();
            }}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { dialog };
}
