import { useEffect } from "react";
import { useBlocker } from "@tanstack/react-router";

type Options = {
  /** True quando há alterações não salvas. */
  when: boolean;
  /** Mensagem exibida na confirmação de navegação interna. */
  message?: string;
};

const DEFAULT_MESSAGE =
  "Você tem alterações não salvas. Deseja sair mesmo assim? As alterações podem ser perdidas.";

/**
 * Bloqueia saída (fechar aba, navegar internamente) quando `when` é true,
 * pedindo confirmação ao usuário. Usado para proteger rascunhos em edição
 * enquanto o autosave ainda não persistiu.
 */
export function useUnsavedChangesGuard({ when, message = DEFAULT_MESSAGE }: Options) {
  // Fechar aba / recarregar página / navegar para outra origem.
  useEffect(() => {
    if (!when) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Browsers modernos ignoram o texto customizado, mas exigem returnValue.
      e.returnValue = message;
      return message;
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [when, message]);

  // Navegação interna do TanStack Router.
  useBlocker({
    shouldBlockFn: () => {
      if (!when) return false;
      if (typeof window === "undefined") return false;
      return !window.confirm(message);
    },
    enableBeforeUnload: false, // já tratamos acima com mensagem customizada
  });
}
