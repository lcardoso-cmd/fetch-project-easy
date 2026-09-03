import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { PlusCircle, Star, Trash2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  CRM_STAGE_LABELS,
  LEAD_KIND_LABELS,
  LEAD_STATUS_LABELS,
  formatCents,
  type CrmStage,
  type LeadKind,
  type LeadStatus,
} from "@/lib/crm-schema";
import { deleteContact, getLead, upsertContact } from "@/lib/crm.functions";

type Props = {
  leadId: string | null;
  onOpenChange: (open: boolean) => void;
  canWrite: boolean;
};

export function LeadDetailSheet({ leadId, onOpenChange, canWrite }: Props) {
  const qc = useQueryClient();
  const fetchLead = useServerFn(getLead);
  const saveContact = useServerFn(upsertContact);
  const removeContact = useServerFn(deleteContact);
  const [contact, setContact] = useState({ name: "", role_title: "", email: "", phone: "" });

  const query = useQuery({
    queryKey: ["crm-lead", leadId],
    queryFn: () => fetchLead({ data: { id: leadId! } }),
    enabled: !!leadId,
  });

  async function addContact() {
    if (!leadId) return;
    try {
      await saveContact({
        data: {
          lead_id: leadId,
          name: contact.name.trim(),
          role_title: contact.role_title.trim() || null,
          email: contact.email.trim() || null,
          phone: contact.phone.trim() || null,
          is_primary: false,
        },
      });
      setContact({ name: "", role_title: "", email: "", phone: "" });
      toast.success("Contato adicionado.");
      void qc.invalidateQueries({ queryKey: ["crm-lead", leadId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar o contato.");
    }
  }

  async function makePrimary(id: string, name: string) {
    if (!leadId) return;
    try {
      await saveContact({ data: { id, lead_id: leadId, name, is_primary: true } });
      void qc.invalidateQueries({ queryKey: ["crm-lead", leadId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível atualizar.");
    }
  }

  async function drop(id: string) {
    try {
      await removeContact({ data: { id } });
      void qc.invalidateQueries({ queryKey: ["crm-lead", leadId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível excluir.");
    }
  }

  const lead = query.data?.lead as any;
  const contacts = (query.data?.contacts ?? []) as any[];
  const opportunities = (query.data?.opportunities ?? []) as any[];

  return (
    <Sheet open={!!leadId} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{lead?.name ?? "Potencial cliente"}</SheetTitle>
          <SheetDescription>
            {lead
              ? `${LEAD_KIND_LABELS[(lead.kind as LeadKind) ?? "person"]} · ${
                  LEAD_STATUS_LABELS[(lead.status as LeadStatus) ?? "lead"]
                }`
              : "Carregando…"}
          </SheetDescription>
        </SheetHeader>

        {query.isLoading && (
          <p className="mt-4 text-sm text-muted-foreground">Carregando dados…</p>
        )}
        {query.isError && (
          <p className="mt-4 text-sm text-destructive" role="alert">
            {(query.error as Error).message}
          </p>
        )}

        {lead && (
          <div className="mt-4 space-y-6">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Documento</dt>
                <dd>{lead.document || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Origem</dt>
                <dd>{lead.source || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">E-mail</dt>
                <dd className="break-all">{lead.email || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Telefone</dt>
                <dd>{lead.phone || "—"}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs text-muted-foreground">Endereço</dt>
                <dd>
                  {[lead.address, lead.city, lead.state].filter(Boolean).join(", ") || "—"}
                </dd>
              </div>
              {lead.notes && (
                <div className="col-span-2">
                  <dt className="text-xs text-muted-foreground">Anotações</dt>
                  <dd className="whitespace-pre-wrap">{lead.notes}</dd>
                </div>
              )}
            </dl>

            <Separator />

            <section className="space-y-3">
              <h3 className="text-sm font-semibold">Contatos</h3>
              {contacts.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum contato cadastrado.
                </p>
              ) : (
                <ul className="space-y-2">
                  {contacts.map((c) => (
                    <li
                      key={c.id}
                      className="flex items-start justify-between gap-2 rounded border p-2 text-sm"
                    >
                      <div>
                        <p className="font-medium">
                          {c.name}
                          {c.is_primary && (
                            <Badge variant="secondary" className="ml-2">
                              Principal
                            </Badge>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {[c.role_title, c.email, c.phone].filter(Boolean).join(" · ") || "—"}
                        </p>
                      </div>
                      {canWrite && (
                        <div className="flex gap-1">
                          {!c.is_primary && (
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label={`Definir ${c.name} como contato principal`}
                              onClick={() => void makePrimary(c.id, c.name)}
                            >
                              <Star className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={`Excluir contato ${c.name}`}
                            onClick={() => void drop(c.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {canWrite && (
                <div className="grid gap-2 rounded border p-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="c-name" className="text-xs">
                      Nome
                    </Label>
                    <Input
                      id="c-name"
                      value={contact.name}
                      onChange={(e) => setContact((c) => ({ ...c, name: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="c-role" className="text-xs">
                      Cargo
                    </Label>
                    <Input
                      id="c-role"
                      value={contact.role_title}
                      onChange={(e) =>
                        setContact((c) => ({ ...c, role_title: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="c-email" className="text-xs">
                      E-mail
                    </Label>
                    <Input
                      id="c-email"
                      value={contact.email}
                      onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="c-phone" className="text-xs">
                      Telefone
                    </Label>
                    <Input
                      id="c-phone"
                      value={contact.phone}
                      onChange={(e) => setContact((c) => ({ ...c, phone: e.target.value }))}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Button
                      size="sm"
                      disabled={contact.name.trim().length < 2}
                      onClick={() => void addContact()}
                    >
                      <PlusCircle className="mr-2 h-4 w-4" /> Adicionar contato
                    </Button>
                  </div>
                </div>
              )}
            </section>

            <Separator />

            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Oportunidades</h3>
              {opportunities.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma oportunidade vinculada.
                </p>
              ) : (
                <ul className="space-y-2">
                  {opportunities.map((o) => (
                    <li key={o.id} className="rounded border p-2 text-sm">
                      <Link
                        to="/comercial"
                        search={{ view: "oportunidades", opportunity: o.id }}
                        className="font-medium hover:underline"
                        onClick={() => onOpenChange(false)}
                      >
                        {o.title}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {CRM_STAGE_LABELS[(o.stage as CrmStage) ?? "new_contact"]} ·{" "}
                        {formatCents(o.estimated_value_cents, o.currency ?? "BRL")}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
