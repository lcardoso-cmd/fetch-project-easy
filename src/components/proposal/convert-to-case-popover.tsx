import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FolderPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { convertProposalToCase } from "@/lib/proposal-attachments.functions";

type Props = {
  disabled?: boolean;
  attachmentIds: string[];
  fromCaseId: string | null;
  defaults: {
    title: string;
    client_name: string;
    description: string;
    case_type: string;
    jurisdiction: string;
  };
  onConverted: (caseId: string) => void;
};

export function ConvertToCasePopover({
  disabled,
  attachmentIds,
  fromCaseId,
  defaults,
  onConverted,
}: Props) {
  const qc = useQueryClient();
  const convertFn = useServerFn(convertProposalToCase);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(defaults.title);
  const [clientName, setClientName] = useState(defaults.client_name);
  const [description, setDescription] = useState(defaults.description);
  const [caseType, setCaseType] = useState(defaults.case_type);
  const [jurisdiction, setJurisdiction] = useState(defaults.jurisdiction);

  const mut = useMutation({
    mutationFn: () =>
      convertFn({
        data: {
          case: {
            title: title.trim() || `Proposta — ${clientName || "Cliente"}`,
            client_name: clientName || null,
            description: description || null,
            case_type: caseType || null,
            jurisdiction: jurisdiction || null,
          },
          attachment_ids: attachmentIds,
          from_case_id: fromCaseId,
        },
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["cases"] });
      qc.invalidateQueries({ queryKey: ["cases", "list-for-proposal"] });
      qc.invalidateQueries({ queryKey: ["proposal-attachments"] });
      onConverted(res.case_id);
      setOpen(false);
      const failures = res.attachment_failures?.length ?? 0;
      toast.success("Caso criado a partir da proposta", {
        description: failures
          ? `${failures} anexo(s) não puderam ser migrados.`
          : "Anexos migrados para o caso.",
        action: {
          label: "Abrir caso",
          onClick: () => {
            window.location.href = `/cases/${res.case_id}`;
          },
        },
      });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Falha ao converter em caso");
    },
  });

  const openPopover = () => {
    setTitle(defaults.title);
    setClientName(defaults.client_name);
    setDescription(defaults.description);
    setCaseType(defaults.case_type);
    setJurisdiction(defaults.jurisdiction);
    setOpen(true);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          onClick={openPopover}
          disabled={disabled}
          className="h-7 px-2"
        >
          <FolderPlus className="mr-1 h-3.5 w-3.5" /> Converter em caso
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 space-y-3">
        <div>
          <p className="text-sm font-semibold">Criar caso a partir da proposta</p>
          <p className="text-xs text-muted-foreground">
            {attachmentIds.length > 0
              ? `${attachmentIds.length} anexo(s) serão migrados para o caso.`
              : "Nenhum anexo será migrado."}
          </p>
        </div>
        <div className="space-y-1">
          <Label htmlFor="c-title" className="text-xs">
            Título do caso
          </Label>
          <Input id="c-title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="c-client" className="text-xs">
            Cliente
          </Label>
          <Input
            id="c-client"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label htmlFor="c-type" className="text-xs">
              Tipo
            </Label>
            <Input
              id="c-type"
              placeholder="Ex.: Cível"
              value={caseType}
              onChange={(e) => setCaseType(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="c-jur" className="text-xs">
              Jurisdição
            </Label>
            <Input
              id="c-jur"
              placeholder="Ex.: TJSP"
              value={jurisdiction}
              onChange={(e) => setJurisdiction(e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="c-desc" className="text-xs">
            Descrição
          </Label>
          <Textarea
            id="c-desc"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button size="sm" onClick={() => mut.mutate()} disabled={mut.isPending}>
            {mut.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
            Criar caso
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
