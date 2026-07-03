import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft, Download, Eye, FileText, Lock, Send } from "lucide-react";
import { AttachmentPreviewDialog } from "@/components/attachments/attachment-preview-dialog";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCapabilities } from "@/hooks/use-capabilities";
import {
  getB2bRequest,
  addB2bRequestNote,
  updateB2bRequestStatus,
  getB2bAttachmentUrl,
  B2B_REQUEST_STATUSES,
  B2B_REQUEST_STATUS_LABEL,
  B2B_URGENCY_LABEL,
  type B2bRequestStatus,
} from "@/lib/b2b-services.functions";

export const Route = createFileRoute("/_authenticated/contratar-b2b/$requestId")({
  component: HireB2bRequestDetail,
});

const STATUS_COLOR: Record<B2bRequestStatus, string> = {
  novo: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  em_analise: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  proposta_enviada: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  aceita: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  recusada: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  cancelada: "bg-muted text-muted-foreground",
  concluido: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
};

function HireB2bRequestDetail() {
  const { requestId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { capabilities } = useCapabilities();
  const isStaff =
    capabilities.includes("platform_admin") || capabilities.includes("super_admin");

  const getFn = useServerFn(getB2bRequest);
  const noteFn = useServerFn(addB2bRequestNote);
  const statusFn = useServerFn(updateB2bRequestStatus);
  const urlFn = useServerFn(getB2bAttachmentUrl);

  const { data, isLoading } = useQuery({
    queryKey: ["b2b-request", requestId],
    queryFn: () => getFn({ data: { id: requestId } }),
  });

  const [note, setNote] = useState("");
  const [visibility, setVisibility] = useState<"public" | "internal">("public");
  const [sending, setSending] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);

  if (isLoading || !data) {
    return <div className="text-sm text-muted-foreground">Carregando…</div>;
  }
  const { request, events: rawEvents, attachments } = data;
  const events = [...rawEvents].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  const sendNote = async () => {
    if (!note.trim()) return;
    setSending(true);
    try {
      await noteFn({
        data: { request_id: request.id, text: note.trim(), visibility },
      });
      setNote("");
      await qc.invalidateQueries({ queryKey: ["b2b-request", requestId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao enviar");
    } finally {
      setSending(false);
    }
  };

  const changeStatus = async (next: B2bRequestStatus) => {
    try {
      await statusFn({ data: { id: request.id, status: next } });
      toast.success(`Status: ${B2B_REQUEST_STATUS_LABEL[next]}`);
      await qc.invalidateQueries({ queryKey: ["b2b-request", requestId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao atualizar");
    }
  };

  const downloadAttachment = async (id: string, fileName: string) => {
    try {
      const { url } = await urlFn({ data: { id } });
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao baixar");
    }
  };

  const previewAtt = previewId
    ? attachments.find((a) => a.id === previewId) ?? null
    : null;

  return (
    <div className="max-w-4xl space-y-6">
      <Button
        variant="ghost"
        size="sm"
        onClick={() =>
          navigate({
            to: isStaff ? "/plataforma/solicitacoes" : "/contratar-b2b",
          })
        }
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Voltar
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">{request.title}</h1>
          <div className="text-sm text-muted-foreground">
            Aberta em{" "}
            {format(parseISO(request.created_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", {
              locale: ptBR,
            })}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={STATUS_COLOR[request.status]}>
            {B2B_REQUEST_STATUS_LABEL[request.status]}
          </Badge>
          <Badge variant="outline">
            Urgência: {B2B_URGENCY_LABEL[request.urgency]}
          </Badge>
        </div>
      </div>

      {isStaff && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="text-base">Painel B2B</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-muted-foreground">Alterar status:</span>
            <Select
              value={request.status}
              onValueChange={(v) => changeStatus(v as B2bRequestStatus)}
            >
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {B2B_REQUEST_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {B2B_REQUEST_STATUS_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Demanda</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="whitespace-pre-wrap">{request.description}</div>
          <Separator />
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <div className="text-xs text-muted-foreground">Serviço</div>
              <div>{request.service_slug}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Prazo desejado</div>
              <div>
                {request.desired_deadline
                  ? format(parseISO(request.desired_deadline), "dd/MM/yyyy")
                  : "—"}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">E-mail</div>
              <div>{request.contact_email}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Telefone</div>
              <div>{request.contact_phone || "—"}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Documentos ({attachments.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {attachments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum anexo enviado.</p>
          ) : (
            <ul className="space-y-2">
              {attachments.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between border rounded-md p-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm truncate">{a.file_name}</span>
                    {a.visibility === "internal" && (
                      <Badge variant="outline" className="gap-1">
                        <Lock className="h-3 w-3" /> Interno
                      </Badge>
                    )}
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => openAttachment(a.id)}>
                    <Download className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Conversa</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            {events.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum evento ainda.</p>
            )}
            {events.map((e) => {
              const isNote = e.kind === "note_public" || e.kind === "note_internal";
              const isInternal = e.kind === "note_internal";
              return (
                <div
                  key={e.id}
                  className={`border rounded-md p-3 text-sm ${
                    isInternal ? "bg-amber-500/5 border-amber-500/30" : ""
                  }`}
                >
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                    <span className="flex items-center gap-2">
                      {isInternal && <Lock className="h-3 w-3" />}
                      {e.kind === "created" && "Solicitação criada"}
                      {e.kind === "status_change" &&
                        `Status alterado: ${
                          B2B_REQUEST_STATUS_LABEL[
                            (e.payload.to ?? "novo") as B2bRequestStatus
                          ]
                        }`}
                      {isNote && (isInternal ? "Nota interna" : "Mensagem")}
                      {e.kind === "attachment" && `Anexo: ${e.payload.file_name ?? ""}`}
                    </span>
                    <span>
                      {format(parseISO(e.created_at), "dd/MM HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                  {isNote && e.payload.text && (
                    <div className="whitespace-pre-wrap">{e.payload.text}</div>
                  )}
                </div>
              );
            })}
          </div>

          <Separator />

          <div className="space-y-2">
            <Textarea
              rows={3}
              value={note}
              onChange={(ev) => setNote(ev.target.value)}
              placeholder={
                isStaff
                  ? "Escreva uma resposta ou nota interna…"
                  : "Adicione informações ou responda à B2B…"
              }
            />
            <div className="flex items-center justify-between gap-2 flex-wrap">
              {isStaff ? (
                <Select
                  value={visibility}
                  onValueChange={(v) => setVisibility(v as typeof visibility)}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Visível ao cliente</SelectItem>
                    <SelectItem value="internal">Só equipe B2B</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <span className="text-xs text-muted-foreground">
                  Sua mensagem será enviada à equipe B2B.
                </span>
              )}
              <Button onClick={sendNote} disabled={sending || !note.trim()}>
                <Send className="mr-2 h-4 w-4" />
                Enviar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {!isStaff && (
        <div className="text-xs text-muted-foreground text-center">
          Precisa de ajuda? Entre em contato pelo e-mail{" "}
          <Link
            to="/contratar-b2b"
            className="underline"
          >
            lcardoso@b2bconsulting.com.br
          </Link>
          .
        </div>
      )}
    </div>
  );
}
