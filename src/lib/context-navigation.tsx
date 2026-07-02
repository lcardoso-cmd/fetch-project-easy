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

// ---------------------------------------------------------------------------
// Form helpers — mesma união `JurisMindContext` propagada para handlers de
// formulário (onChange / onSubmit / onBlur / onFocus). O objetivo é que
// qualquer autor de componente de form receba autocomplete no `context` e
// erros de compilação se digitar um valor fora da união.
// ---------------------------------------------------------------------------

/** Payload passado para todo handler de form contextualizado. */
export interface ContextFormEventMeta {
  /** Superfície de origem — mesma união usada pelo `JurisMindMark`. */
  context: JurisMindContext;
  /** Nome do campo (`event.currentTarget.name`), quando disponível. */
  name?: string;
  /** Timestamp ISO para agrupamento de eventos. */
  at: string;
}

export type ContextChangeHandler<
  E extends HTMLElement = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
> = (event: React.ChangeEvent<E>, meta: ContextFormEventMeta) => void;

export type ContextSubmitHandler = (
  event: React.FormEvent<HTMLFormElement>,
  meta: ContextFormEventMeta,
) => void | Promise<void>;

export type ContextFocusHandler<E extends HTMLElement = HTMLElement> = (
  event: React.FocusEvent<E>,
  meta: ContextFormEventMeta,
) => void;

function metaFor(
  context: JurisMindContext,
  target?: { name?: string } | null,
): ContextFormEventMeta {
  return {
    context: safeContext(context),
    name: target?.name || undefined,
    at: new Date().toISOString(),
  };
}

/**
 * Cria um `onChange` tipado que injeta `{ context, name, at }` no handler.
 *
 * @example
 * const onChange = createContextChangeHandler(JURISMIND_CONTEXT.auth, (e, meta) => {
 *   setEmail(e.target.value);
 *   analytics.track("field_change", meta);
 * });
 * <Input name="email" onChange={onChange} />
 */
export function createContextChangeHandler<
  E extends HTMLElement = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
>(
  context: JurisMindContext,
  handler: ContextChangeHandler<E>,
): (event: React.ChangeEvent<E>) => void {
  const safe = safeContext(context);
  return (event) => {
    handler(event, metaFor(safe, event.currentTarget as { name?: string }));
  };
}

/**
 * Cria um `onSubmit` tipado que injeta `{ context, at }` no handler.
 *
 * @example
 * const onSubmit = createContextSubmitHandler(JURISMIND_CONTEXT.auth, async (e, meta) => {
 *   e.preventDefault();
 *   await signIn();
 *   analytics.track("form_submit", meta);
 * });
 */
export function createContextSubmitHandler(
  context: JurisMindContext,
  handler: ContextSubmitHandler,
): (event: React.FormEvent<HTMLFormElement>) => void | Promise<void> {
  const safe = safeContext(context);
  return (event) =>
    handler(event, metaFor(safe, event.currentTarget as { name?: string }));
}

/**
 * Hook que devolve fábricas prontas para o `context` atual — evita repetir a
 * superfície em cada handler dentro do mesmo componente de formulário.
 *
 * @example
 * const { onChange, onSubmit, onFocus, onBlur, context } =
 *   useContextFormHandlers(JURISMIND_CONTEXT.auth);
 * <form onSubmit={onSubmit((e, meta) => { ... })}>
 *   <input name="email" onChange={onChange((e, meta) => setEmail(e.target.value))} />
 * </form>
 */
export function useContextFormHandlers(context: JurisMindContext) {
  const safe = safeContext(context);
  return React.useMemo(
    () => ({
      context: safe,
      onChange: <
        E extends HTMLElement =
          | HTMLInputElement
          | HTMLTextAreaElement
          | HTMLSelectElement,
      >(
        handler: ContextChangeHandler<E>,
      ) => createContextChangeHandler<E>(safe, handler),
      onSubmit: (handler: ContextSubmitHandler) =>
        createContextSubmitHandler(safe, handler),
      onFocus:
        <E extends HTMLElement = HTMLElement>(handler: ContextFocusHandler<E>) =>
        (event: React.FocusEvent<E>) =>
          handler(event, metaFor(safe, event.currentTarget as { name?: string })),
      onBlur:
        <E extends HTMLElement = HTMLElement>(handler: ContextFocusHandler<E>) =>
        (event: React.FocusEvent<E>) =>
          handler(event, metaFor(safe, event.currentTarget as { name?: string })),
    }),
    [safe],
  );
}

/**
 * `<ContextForm>` — thin wrapper em `<form>` que aceita `context` tipado e
 * repassa a superfície ao `onSubmit`. Use quando quiser manter o handler
 * inline sem chamar `createContextSubmitHandler` explicitamente.
 */
export interface ContextFormProps
  extends Omit<React.FormHTMLAttributes<HTMLFormElement>, "onSubmit"> {
  context: JurisMindContext;
  onSubmit?: ContextSubmitHandler;
}

export const ContextForm = React.forwardRef<HTMLFormElement, ContextFormProps>(
  function ContextForm({ context, onSubmit, ...rest }, ref) {
    const safe = safeContext(context);
    const handleSubmit = React.useCallback(
      (event: React.FormEvent<HTMLFormElement>) => {
        if (!onSubmit) return;
        return onSubmit(event, metaFor(safe, event.currentTarget));
      },
      [safe, onSubmit],
    );
    return <form ref={ref} {...rest} onSubmit={handleSubmit} />;
  },
);
