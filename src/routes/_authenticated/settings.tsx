import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Plus, Trash2, Loader2, Users } from "lucide-react";
import { toast } from "sonner";
import {
  listTeamMembers,
  createTeamMember,
  deleteTeamMember,
} from "@/lib/team.functions";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listTeamMembers);
  const createFn = useServerFn(createTeamMember);
  const deleteFn = useServerFn(deleteTeamMember);

  const { data: team = [], isLoading } = useQuery({
    queryKey: ["team-members"],
    queryFn: () => listFn(),
  });

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");

  const createMut = useMutation({
    mutationFn: () => createFn({ data: { name: name.trim(), email: email.trim(), role: role.trim() } }),
    onSuccess: () => {
      toast.success("Membro adicionado");
      setName("");
      setEmail("");
      setRole("");
      qc.invalidateQueries({ queryKey: ["team-members"] });
    },
    onError: (e: Error) => toast.error(e.message || "Falha ao adicionar"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Membro removido");
      qc.invalidateQueries({ queryKey: ["team-members"] });
    },
    onError: (e: Error) => toast.error(e.message || "Falha ao remover"),
  });

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold font-heading tracking-tight">Configurações</h1>
        <p className="mt-1 text-muted-foreground">Gerencie sua equipe e preferências.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" /> Equipe
          </CardTitle>
          <CardDescription>
            Cadastre os membros do seu escritório para alocar em casos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : team.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum membro cadastrado ainda.</p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {team.map((m) => (
                <li key={m.id} className="flex items-center justify-between p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{m.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {[m.role, m.email].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => {
                      if (confirm(`Remover ${m.name}?`)) deleteMut.mutate(m.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <div className="rounded-lg border p-4 space-y-3">
            <p className="text-sm font-medium">Adicionar membro</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <Label htmlFor="m-name">Nome *</Label>
                <Input id="m-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="m-role">Cargo</Label>
                <Input id="m-role" value={role} onChange={(e) => setRole(e.target.value)} maxLength={120} placeholder="Ex.: Sócio, Estagiário" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="m-email">E-mail</Label>
                <Input id="m-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={255} />
              </div>
            </div>
            <Button
              size="sm"
              onClick={() => createMut.mutate()}
              disabled={!name.trim() || createMut.isPending}
            >
              {createMut.isPending ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-1 h-4 w-4" />
              )}
              Adicionar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
