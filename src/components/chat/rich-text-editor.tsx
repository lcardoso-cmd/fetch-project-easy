import { useCallback, useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { sanitizeProposalHtml } from "@/lib/sanitize-html";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Undo2,
  Redo2,
} from "lucide-react";

interface Props {
  html: string;
  onChange: (html: string) => void;
  minHeight?: number;
  /**
   * Classe aplicada ao contentEditable. Permite trocar a tipografia padrão
   * (prose/serif) por variantes como `word-doc` para casar com o template
   * do .docx exportado.
   */
  contentClassName?: string;
  /**
   * Tempo para avisar o componente pai depois de digitação normal.
   * O DOM editável fica local e imediato; isso evita que autosave/re-render
   * do pai restaure o HTML antigo e jogue o cursor para trás.
   */
  changeDelayMs?: number;
}


/** Remove tags perigosas e atributos indesejados de um HTML colado. */
function sanitizePastedHtml(raw: string): string {
  if (!raw) return "";
  let s = raw;
  // remove blocos perigosos por completo (com conteúdo)
  s = s.replace(/<(script|style|iframe|object|embed|link|meta)[^>]*>[\s\S]*?<\/\1>/gi, "");
  s = s.replace(/<(script|style|iframe|object|embed|link|meta)[^>]*\/?>/gi, "");
  // strip on* handlers e class/id
  s = s.replace(/\s(on[a-z]+|class|id)\s*=\s*"[^"]*"/gi, "");
  s = s.replace(/\s(on[a-z]+|class|id)\s*=\s*'[^']*'/gi, "");
  s = s.replace(/\sstyle\s*=\s*"[^"]*"/gi, "");
  s = s.replace(/\sstyle\s*=\s*'[^']*'/gi, "");
  // strip href javascript:
  s = s.replace(/\shref\s*=\s*"javascript:[^"]*"/gi, "");
  return s;
}

export function RichTextEditor({ html, onChange, minHeight = 360, contentClassName, changeDelayMs = 900 }: Props) {
  const safeHtml = useMemo(() => sanitizeProposalHtml(html), [html]);
  const ref = useRef<HTMLDivElement>(null);
  const lastEmittedRef = useRef<string>(safeHtml);
  const lastExternalHtmlRef = useRef<string>(safeHtml);
  const emitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const composingRef = useRef(false);

  const setEditorRef = useCallback((node: HTMLDivElement | null) => {
    ref.current = node;
    if (node && node.innerHTML !== lastExternalHtmlRef.current) {
      node.innerHTML = lastExternalHtmlRef.current || "";
    }
  }, []);

  // Sync externo: quando `html` prop muda por fora (IA gerou, restaurou versão,
  // rascunho carregou), refletir no contentEditable. Ignora se a mudança veio do
  // próprio editor (evita reset de cursor a cada tecla).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (safeHtml === lastExternalHtmlRef.current) return;
    lastExternalHtmlRef.current = safeHtml;
    if (safeHtml === lastEmittedRef.current) return;
    // Enquanto o usuário está digitando, nunca sobrescreva o DOM do
    // contentEditable a partir da prop. Mesmo pequenas normalizações do
    // DOMPurify/browser mudam a string HTML e resetam o caret/foco.
    if (document.activeElement === el) return;
    if (el.innerHTML === safeHtml) {
      lastEmittedRef.current = safeHtml;
      return;
    }
    el.innerHTML = safeHtml || "";
    lastEmittedRef.current = safeHtml;
  }, [safeHtml]);

  useEffect(() => {
    return () => {
      if (emitTimerRef.current) clearTimeout(emitTimerRef.current);
    };
  }, []);

  const emit = (immediate = false) => {
    if (!ref.current || composingRef.current) return;
    const current = ref.current.innerHTML;
    // Guarda a versão *sanitizada* — o pai vai reemitir `html`, o efeito
    // recomputa `safeHtml = sanitize(html)` e compara com este ref. Se
    // guardássemos `current` cru, DOMPurify poderia normalizar atributos
    // e reescrever `innerHTML` a cada tecla, resetando o cursor.
    const sanitized = sanitizeProposalHtml(current);
    lastEmittedRef.current = sanitized;
    if (emitTimerRef.current) clearTimeout(emitTimerRef.current);
    if (immediate) {
      onChange(sanitized);
      return;
    }
    emitTimerRef.current = setTimeout(() => {
      onChange(sanitized);
    }, changeDelayMs);
  };

  const exec = (cmd: string, value?: string) => {
    ref.current?.focus();
    document.execCommand(cmd, false, value);
    emit(true);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const cd = e.clipboardData;
    if (!cd) return;
    const asHtml = cd.getData("text/html");
    const asText = cd.getData("text/plain");
    if (asHtml) {
      e.preventDefault();
      const clean = sanitizePastedHtml(asHtml);
      document.execCommand("insertHTML", false, clean);
      emit(true);
    } else if (asText) {
      e.preventDefault();
      const paragraphs = asText
        .split(/\n{2,}/)
        .map((p) => `<p>${p.replace(/\n/g, "<br>").replace(/</g, "&lt;")}</p>`)
        .join("");
      document.execCommand("insertHTML", false, paragraphs);
      emit(true);
    }
  };

  const ToolBtn = ({
    label,
    cmd,
    value,
    children,
  }: {
    label: string;
    cmd: string;
    value?: string;
    children: React.ReactNode;
  }) => (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      className="h-8 w-8"
      title={label}
      onMouseDown={(e) => {
        e.preventDefault();
        exec(cmd, value);
      }}
    >
      {children}
    </Button>
  );

  return (
    <div className="rounded-md border bg-background">
      <div className="flex flex-wrap items-center gap-0.5 border-b bg-muted/40 px-1.5 py-1">
        <ToolBtn label="Negrito" cmd="bold">
          <Bold className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn label="Itálico" cmd="italic">
          <Italic className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn label="Sublinhado" cmd="underline">
          <UnderlineIcon className="h-3.5 w-3.5" />
        </ToolBtn>
        <div className="mx-1 h-5 w-px bg-border" />
        <ToolBtn label="Título 1" cmd="formatBlock" value="H1">
          <Heading1 className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn label="Título 2" cmd="formatBlock" value="H2">
          <Heading2 className="h-3.5 w-3.5" />
        </ToolBtn>
        <div className="mx-1 h-5 w-px bg-border" />
        <ToolBtn label="Lista" cmd="insertUnorderedList">
          <List className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn label="Lista numerada" cmd="insertOrderedList">
          <ListOrdered className="h-3.5 w-3.5" />
        </ToolBtn>
        <div className="mx-1 h-5 w-px bg-border" />
        <ToolBtn label="Alinhar à esquerda" cmd="justifyLeft">
          <AlignLeft className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn label="Centralizar" cmd="justifyCenter">
          <AlignCenter className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn label="Alinhar à direita" cmd="justifyRight">
          <AlignRight className="h-3.5 w-3.5" />
        </ToolBtn>
        <div className="mx-1 h-5 w-px bg-border" />
        <ToolBtn label="Desfazer" cmd="undo">
          <Undo2 className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn label="Refazer" cmd="redo">
          <Redo2 className="h-3.5 w-3.5" />
        </ToolBtn>
      </div>
      {/* Folha "papel" sempre clara para garantir legibilidade em ambos os temas
          e casar visualmente com o .docx exportado. */}
      <div className="bg-white p-2 dark:bg-slate-200">
        <div
          ref={setEditorRef}
          contentEditable
          role="textbox"
          aria-multiline="true"
          aria-label="Editor de proposta"
          suppressContentEditableWarning
          onInput={() => emit()}
          onBlur={() => emit(true)}
          onCompositionStart={() => { composingRef.current = true; }}
          onCompositionEnd={() => { composingRef.current = false; emit(); }}
          onPaste={handlePaste}
          className={
            contentClassName
              ? `${contentClassName} bg-white text-slate-900`
              : "prose prose-sm max-w-none rounded bg-white p-4 font-serif leading-relaxed text-slate-900 focus:outline-none"
          }
          style={{ minHeight }}
        />
      </div>
    </div>
  );
}
