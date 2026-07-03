import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Copy, Loader2, Link2, ShieldCheck, Trash2, Ban, Check } from "lucide-react";
import {
  createProposalShare,
  listProposalShares,
  revokeProposalShare,
  deleteProposalShare,
  type ProposalShare,
} from "@/lib/proposal-shares.functions";

export type PdfShareSnapshot = {
  title: string;
  clientName: string | null;
  html: string;
  page: {
    format: "A4" | "Letter";
    orientation: "portrait" | "landscape";
    margins: { top: number; right: number; bottom: number; left: number };
  };
  cover: {
    clientName?: string;
    clientDocument?: string;
    clientAddress?: string;
    matter?: string;
  } | null;
  watermark: { text: string; opacity?: number } | null;
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  snapshot: PdfShareSnapshot | null;
}

const EXPIRY_OPTIONS: { value: string; label: string }[] = [
  { value: "1", label: "24 horas" },
  { value: "3", label: "3 dias" },
  { value: "7", label: "7 dias" },
  { value: "14", label: "14 dias" },
  { value: "30", label: "30 dias" },
  { value: "0", label: "Sem expiração" },
];

function buildShareUrl(token: string): string {
  if (typeof window === "undefined") return `/p/${token}`;
  return `${window.location.origin}/p/${token}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function shareStatus(s: ProposalShare): { label: string; tone: "ok" | "warn" | "danger" } {
  if (s.revoked_at) return { label: "Revogado", tone: "danger" };
  if (s.expires_at && new Date(s.expires_at).getTime() < Date.now()) {
    return { label: "Expirado", tone: "danger" };
  }
  if (typeof s.max_downloads === "number" && s.download_count >= s.max_downloads) {
    return { label: "Limite atingido", tone: "warn" };
  }
  return { label: "Ativo", tone: "ok" };
}

export function ShareProposalDialog({ open, onOpenChange, snapshot }: Props) {
  const qc = useQueryClient();
  const createFn = useServerFn(createProposalShare);
  const listFn = useServerFn(listProposalShares);
  const revokeFn = useServerFn(revokeProposalShare);
  const deleteFn = useServerFn(deleteProposalShare);

  const listQ = useQuery({
    queryKey: ["proposal-shares"],
    queryFn: () => listFn(),
    enabled: open,
    staleTime: 15_000,
  });

  const [expiry, setExpiry] = useState("7");
  const [passwordEnabled, setPasswordEnabled] = useState(false);
  const [password, setPassword] = useState("");
  const [limitEnabled, setLimitEnabled] = useState(false);
  const [maxDownloads, setMaxDownloads] = useState("5");
  const [justCreatedToken, setJustCreatedToken] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setJustCreatedToken(null);
      setPassword("");
    }
  }, [open]);

  const createMut = useMutation({
    mutationFn: async () => {
      if (!snapshot) throw new Error("Gere a proposta antes de compartilhar.");
      const days = Number(expiry);
      const payload = {
        title: snapshot.title,
        client_name: snapshot.clientName,
        html: snapshot.html,
        page: snapshot.page,
        cover: snapshot.cover,
        watermark: snapshot.watermark,
        password: passwordEnabled && password.trim() ? password : null,
        expires_in_days: days > 0 ? days : null,
        max_downloads: limitEnabled ? Number(maxDownloads) || null : null,
      };
      return createFn({ data: payload });
    },
    onSuccess: async (share) => {
      setJustCreatedToken(share.token);
      await qc.invalidateQueries({ queryKey: ["proposal-shares"] });
      const url = buildShareUrl(share.token);
      try {
        await navigator.clipboard.writeText(url);
        toast.success("Link seguro criado e copiado.");
      } catch {
        toast.success("Link seguro criado.");
      }
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : "Falha ao criar link.");
    },
  });

  const revokeMut = useMutation({
    mutationFn: (id: string) => revokeFn({ data: { id } }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["proposal-shares"] });
      toast.success("Link revogado.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao revogar."),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["proposal-shares"] });
      toast.success("Link excluído.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao excluir."),
  });

  const copy = async (token: string) => {
    const url = buildShareUrl(token);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedToken(token);
      window.setTimeout(() => setCopiedToken((t) => (t === token ? null : t)), 1800);
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  const canCreate =
    !!snapshot &&
    !createMut.isPending &&
    (!passwordEnabled || password.trim().length >= 4) &&
    (!limitEnabled || Number(maxDownloads) > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <Link2 className="h-5 w-5" /> Compartilhar proposta por link
          </DialogTitle>
          <DialogDescription>
            Envie ao cliente um link seguro para baixar o PDF sem anexar o arquivo. O
            conteúdo atual do editor é salvo no link no momento da criação.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Expira em</Label>
              <Select value={expiry} onValueChange={setExpiry}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPIRY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label htmlFor="share-limit-switch" className="text-xs">
                  Limite de downloads
                </Label>
                <Switch
                  id="share-limit-switch"
                  checked={limitEnabled}
                  onCheckedChange={setLimitEnabled}
                />
              </div>
              <Input
                type="number"
                min={1}
                max={1000}
                disabled={!limitEnabled}
                value={maxDownloads}
                onChange={(e) => setMaxDownloads(e.target.value)}
                className="h-9"
              />
            </div>
          </div>

          <div className="rounded border p-3 space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="share-pw-switch" className="text-xs inline-flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5" /> Proteger com senha
              </Label>
              <Switch
                id="share-pw-switch"
                checked={passwordEnabled}
                onCheckedChange={(v) => {
                  setPasswordEnabled(v);
                  if (!v) setPassword("");
                }}
              />
            </div>
            {passwordEnabled && (
              <>
                <Input
                  type="text"
                  autoComplete="off"
                  placeholder="Senha (mín. 4 caracteres)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-9"
                />
                <p className="text-[11px] text-muted-foreground">
                  Compartilhe a senha em um canal separado do link.
                </p>
              </>
            )}
          </div>

          <Button className="w-full" disabled={!canCreate} onClick={() => createMut.mutate()}>
            {createMut.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Gerando link seguro…
              </>
            ) : (
              <>
                <Link2 className="h-4 w-4 mr-2" /> Gerar link e copiar
              </>
            )}
          </Button>

          {justCreatedToken && (
            <div className="rounded border border-emerald-500/30 bg-emerald-500/10 p-3 space-y-2">
              <p className="text-xs font-medium text-emerald-800 dark:text-emerald-200">
                Link gerado — copiado para a área de transferência.
              </p>
              <div className="flex items-center gap-2">
                <Input readOnly value={buildShareUrl(justCreatedToken)} className="h-8 text-xs" />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copy(justCreatedToken)}
                  aria-label="Copiar link"
                >
                  {copiedToken === justCreatedToken ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-2 pt-2 border-t">
            <p className="text-xs font-medium">Seus links</p>
            {listQ.isLoading ? (
              <div className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin" /> Carregando…
              </div>
            ) : !listQ.data || listQ.data.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum link ainda.</p>
            ) : (
              <ul className="space-y-1.5 max-h-56 overflow-auto pr-1">
                {listQ.data.map((s) => {
                  const status = shareStatus(s);
                  return (
                    <li
                      key={s.id}
                      className="flex items-center gap-2 rounded border p-2 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{s.title}</p>
                        <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                          <span
                            className={
                              status.tone === "ok"
                                ? "text-emerald-700 dark:text-emerald-300"
                                : status.tone === "warn"
                                  ? "text-amber-700 dark:text-amber-300"
                                  : "text-destructive"
                            }
                          >
                            {status.label}
                          </span>
                          <span>· {formatDate(s.created_at)}</span>
                          {s.expires_at && <span>· expira {formatDate(s.expires_at)}</span>}
                          <span>
                            · {s.download_count}
                            {typeof s.max_downloads === "number" ? `/${s.max_downloads}` : ""} DL
                          </span>
                          {s.has_password && <span>· 🔒</span>}
                        </div>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => copy(s.token)}
                        aria-label="Copiar link"
                        disabled={!!s.revoked_at}
                      >
                        {copiedToken === s.token ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </Button>
                      {!s.revoked_at && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-amber-600"
                          onClick={() => revokeMut.mutate(s.id)}
                          disabled={revokeMut.isPending}
                          aria-label="Revogar link"
                          title="Revogar"
                        >
                          <Ban className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive"
                        onClick={() => deleteMut.mutate(s.id)}
                        disabled={deleteMut.isPending}
                        aria-label="Excluir link"
                        title="Excluir"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
