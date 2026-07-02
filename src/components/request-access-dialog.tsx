import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Mail, Loader2, Copy, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getAccessRequestContext } from "@/lib/access-request.functions";
import {
  CAPABILITY_LABELS,
  formatRequiresPhrase,
  type Capability,
} from "@/lib/capabilities.functions";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  requires?: Capability | null;
  attemptedPath?: string;
};

function buildDefaults({
  requires,
  attemptedPath,
  meName,
  meEmail,
}: {
  requires?: Capability | null;
  attemptedPath?: string;
  meName: string | null;
  meEmail: string | null;
}) {
  const capLabel = requires ? CAPABILITY_LABELS[requires] : null;
  const subject = capLabel
    ? `Solicitação de acesso no JurisMind — permissão «${capLabel}»`
    : "Solicitação de acesso no JurisMind";
  const identifier =
    meName && meEmail
      ? `${meName} (${meEmail})`
      : meEmail ?? meName ?? "usuário do escritório";
  const lines = [
    "Olá,",
    "",
    `Sou ${identifier} e preciso de acesso a uma área do JurisMind que está bloqueada para mim.`,
    "",
    ...(requires ? [formatRequiresPhrase(requires), ""] : []),
    ...(attemptedPath ? [`Rota tentada: ${attemptedPath}`, ""] : []),
    "Poderia liberar em Configurações → Equipe e permissões?",
    "",
    "Obrigado.",
  ];
  return { subject, body: lines.join("\n") };
}

export function RequestAccessDialog({
  open,
  onOpenChange,
  requires,
  attemptedPath,
}: Props) {
  const fetchContext = useServerFn(getAccessRequestContext);
  const { data, isLoading } = useQuery({
    queryKey: ["access-request-context"],
    queryFn: () => fetchContext(),
    enabled: open,
    staleTime: 60_000,
  });

  const defaults = useMemo(
    () =>
      buildDefaults({
        requires,
        attemptedPath,
        meName: data?.me.name ?? null,
        meEmail: data?.me.email ?? null,
      }),
    [requires, attemptedPath, data?.me.name, data?.me.email],
  );

  const [to, setTo] = useState("");
  const [subject, setSubject] = useState(defaults.subject);
  const [body, setBody] = useState(defaults.body);
  const [copied, setCopied] = useState(false);

  // Ao abrir ou quando dados chegarem, repõe defaults.
  useEffect(() => {
    if (!open) return;
    setSubject(defaults.subject);
    setBody(defaults.body);
    setCopied(false);
    if (data?.admins?.length) {
      setTo(data.admins.map((a) => a.email).filter(Boolean).join(", "));
    }
  }, [open, defaults.subject, defaults.body, data]);

  const mailto = useMemo(() => {
    const params = new URLSearchParams();
    if (subject) params.set("subject", subject);
    if (body) params.set("body", body);
    return `mailto:${encodeURIComponent(to)}?${params.toString().replace(/\+/g, "%20")}`;
  }, [to, subject, body]);

  const canSend = to.trim().length > 0;

  async function copyBody() {
    try {
      await navigator.clipboard.writeText(`Para: ${to}\nAssunto: ${subject}\n\n${body}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // silencioso
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Solicitar acesso por e-mail</DialogTitle>
          <DialogDescription>
            Enviamos uma mensagem pronta ao administrador do seu escritório. Você
            pode revisar antes de enviar.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Carregando destinatários…
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="req-to">Para</Label>
              <Input
                id="req-to"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="admin@escritorio.com"
                type="email"
              />
              {data?.admins?.length ? (
                <p className="text-xs text-muted-foreground">
                  Sugestões:{" "}
                  {data.admins
                    .map((a) => (a.name ? `${a.name} <${a.email}>` : a.email))
                    .join(", ")}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Não encontramos um administrador cadastrado. Preencha manualmente.
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="req-subject">Assunto</Label>
              <Input
                id="req-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="req-body">Mensagem</Label>
              <Textarea
                id="req-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={9}
              />
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="ghost" onClick={copyBody} disabled={isLoading}>
            {copied ? (
              <>
                <Check className="mr-2 h-4 w-4" /> Copiado
              </>
            ) : (
              <>
                <Copy className="mr-2 h-4 w-4" /> Copiar
              </>
            )}
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button asChild disabled={!canSend}>
              <a
                href={canSend ? mailto : "#"}
                onClick={() => {
                  if (canSend) onOpenChange(false);
                }}
              >
                <Mail className="mr-2 h-4 w-4" />
                Enviar
              </a>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
