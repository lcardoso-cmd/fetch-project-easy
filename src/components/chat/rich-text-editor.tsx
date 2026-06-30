import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
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
}

export function RichTextEditor({ html, onChange, minHeight = 360 }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== html) {
      ref.current.innerHTML = html;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const exec = (cmd: string, value?: string) => {
    document.execCommand(cmd, false, value);
    if (ref.current) onChange(ref.current.innerHTML);
    ref.current?.focus();
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
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={(e) => onChange((e.target as HTMLDivElement).innerHTML)}
        className="prose prose-sm max-w-none p-4 font-serif leading-relaxed text-foreground focus:outline-none"
        style={{ minHeight }}
      />
    </div>
  );
}
