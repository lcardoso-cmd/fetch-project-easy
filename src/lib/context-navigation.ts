/**
 * Helper tipado para navegar/abrir rotas com base no `context` (surface) atual
 * — header, sidebar, landing, auth, chat, etc. — padronizando tracking.
 *
 * Todos os componentes que disparam navegação a partir de uma "superfície"
 * (menu lateral, header, hero da landing, formulário de auth, chat) devem
 * usar `useContextNavigation()` em vez de `useNavigate()` cru. Isso garante
 * que toda navegação emita um evento único (`jurismind:navigate`) com o
 * contexto e o gatilho, alimentando dashboards de analytics sem espalhar
 * `track(...)` pelo app.
 *
 * ```tsx
 * const nav = useContextNavigation(JURISMIND_CONTEXT.header);
 * <Button onClick={() => nav.go({ to: "/assistencias" }, { trigger: "cta" })}>
 *   Assistências
 * </Button>
 * <ContextLink context={JURISMIND_CONTEXT.sidebar} to="/configuracoes">
 *   Configurações
 * </ContextLink>
 * ```
 */
import * as React from "react";
import {
  Link,
  useNavigate,
  type LinkProps,
  type NavigateOptions,
} from "@tanstack/react-router";

import {
  isJurisMindContext,
  type JurisMindContext,
} from "@/components/brand/jurismind-mark";

/** Como a ação foi disparada dentro da superfície. */
export type NavigationTrigger =
  | "link"
  | "cta"
  | "menu"
  | "keyboard"
  | "auto"
  | "back"
  | "external";

export interface NavigationTrackingPayload {
  /** Superfície de origem (sidebar, header, landing, auth, chat, ...). */
  context: JurisMindContext;
  /** Rota destino ou URL absoluta (quando `external`). */
  to: string;
  /** Params tipados do TanStack Router, quando houver. */
  params?: Record<string, unknown>;
  /** Search params, quando houver. */
  search?: Record<string, unknown>;
  /** Como a navegação foi disparada. */
  trigger: NavigationTrigger;
  /** true quando a navegação sai do app (novo tab / window.open). */
  external: boolean;
  /** Timestamp ISO para agrupar eventos por sessão. */
  at: string;
}

const EVENT_NAME = "jurismind:navigate";

function safeContext(context: unknown): JurisMindContext {
  return isJurisMindContext(context) ? context : "sidebar";
}

function emit(payload: NavigationTrackingPayload) {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: payload }));
  } catch {
    /* noop — tracking nunca pode quebrar a navegação. */
  }
}

/** Assine para consumir eventos de navegação (ex.: enviar para analytics). */
export function subscribeToNavigation(
  handler: (payload: NavigationTrackingPayload) => void,
): () => void {
  if (typeof window === "undefined") return () => {};
  const listener = (event: Event) => {
    const detail = (event as CustomEvent<NavigationTrackingPayload>).detail;
    if (detail) handler(detail);
  };
  window.addEventListener(EVENT_NAME, listener);
  return () => window.removeEventListener(EVENT_NAME, listener);
}

export interface ContextGoOptions {
  /** Sobrescreve o trigger padrão (`link`). */
  trigger?: NavigationTrigger;
}

export interface ContextOpenOptions {
  /** Alvo do `window.open`. Default: `_blank`. */
  target?: "_blank" | "_self";
  trigger?: NavigationTrigger;
}

export interface ContextNavigation {
  context: JurisMindContext;
  /** Navega dentro do app, com tracking automático. */
  go: (options: NavigateOptions, extra?: ContextGoOptions) => Promise<void>;
  /** Abre uma URL externa (novo tab por padrão), com tracking. */
  open: (url: string, extra?: ContextOpenOptions) => void;
  /** Emite manualmente um evento de navegação (para casos custom). */
  track: (
    payload: Omit<NavigationTrackingPayload, "context" | "at"> & {
      context?: JurisMindContext;
    },
  ) => void;
}

/**
 * Hook principal: devolve navegação tipada + tracking para a superfície atual.
 */
export function useContextNavigation(
  context: JurisMindContext,
): ContextNavigation {
  const navigate = useNavigate();
  const safe = safeContext(context);

  return React.useMemo<ContextNavigation>(
    () => ({
      context: safe,
      async go(options, extra) {
        emit({
          context: safe,
          to: String(options.to ?? ""),
          params: options.params as Record<string, unknown> | undefined,
          search: options.search as Record<string, unknown> | undefined,
          trigger: extra?.trigger ?? "link",
          external: false,
          at: new Date().toISOString(),
        });
        await navigate(options);
      },
      open(url, extra) {
        emit({
          context: safe,
          to: url,
          trigger: extra?.trigger ?? "external",
          external: true,
          at: new Date().toISOString(),
        });
        if (typeof window !== "undefined") {
          window.open(url, extra?.target ?? "_blank", "noopener,noreferrer");
        }
      },
      track(payload) {
        emit({
          context: payload.context ?? safe,
          to: payload.to,
          params: payload.params,
          search: payload.search,
          trigger: payload.trigger,
          external: payload.external,
          at: new Date().toISOString(),
        });
      },
    }),
    [navigate, safe],
  );
}

export interface ContextLinkProps
  extends Omit<LinkProps, "onClick">,
    Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps> {
  context: JurisMindContext;
  trigger?: NavigationTrigger;
}

/**
 * `<Link>` tipado do TanStack Router com tracking embutido pela superfície.
 * Preserva `params`/`search`/`preload` etc. sem interceptar a navegação.
 */
export const ContextLink = React.forwardRef<HTMLAnchorElement, ContextLinkProps>(
  function ContextLink(
    { context, trigger = "link", onClick, ...rest },
    ref,
  ) {
    const safe = safeContext(context);
    const handleClick = React.useCallback(
      (event: React.MouseEvent<HTMLAnchorElement>) => {
        emit({
          context: safe,
          to: String((rest as { to?: unknown }).to ?? ""),
          params: (rest as { params?: Record<string, unknown> }).params,
          search: (rest as { search?: Record<string, unknown> }).search,
          trigger,
          external: false,
          at: new Date().toISOString(),
        });
        onClick?.(event as never);
      },
      [safe, trigger, onClick, rest],
    );

    // @ts-expect-error — repassamos props tipadas do TanStack Link.
    return <Link ref={ref} {...rest} onClick={handleClick} />;
  },
);
