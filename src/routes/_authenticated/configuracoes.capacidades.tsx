import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Search, Users, ShieldCheck, Briefcase, Microscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CAPABILITY_LABELS,
  getMyCapabilities,
  type Capability,
} from "@/lib/capabilities.functions";
import {
  getCapabilitiesOverview,
  applyCapabilityPreset,
  listPlatformUsers,
} from "@/lib/platform.functions";

type PresetKey = "b2b" | "office_admin" | "perito";

const PRESET_ICON: Record<PresetKey, typeof ShieldCheck> = {
  b2b: ShieldCheck,
  office_admin: Briefcase,
  perito: Microscope,
};

export const Route = createFileRoute("/_authenticated/configuracoes/capacidades")({
  beforeLoad: async () => {
    try {
      const caps = await getMyCapabilities();
      if (!caps.includes("platform_admin") && !caps.includes("super_admin")) {
        throw new Error();
      }
    } catch {
      throw redirect({ to: "/configuracoes" });
    }
  },
  component: CapabilitiesOverviewPage,
});

function CapabilitiesOverviewPage() {
  const overviewFn = useServerFn(getCapabilitiesOverview);
  const { data, isLoading } = useQuery({
    queryKey: ["capabilities-overview"],
    queryFn: () => overviewFn(),
  });

  const [presetOpen, setPresetOpen] = useState<PresetKey | null>(null);

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild className="h-8 w-8">
          <Link to="/configuracoes" aria-label="Voltar">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold font-heading tracking-tight">Capacidades por visão</h1>
          <p className="mt-1 text-muted-foreground">
            Resumo do que cada visão do produto tem hoje e presets para aplicar em massa.
          </p>
        </div>
      </div>

      {isLoading && (
        <p className="text-sm text-muted-foreground">Carregando resumo…</p>
      )}

      {data && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" /> Base de usuários
              </CardTitle>
              <CardDescription>
                {data.totalUsers} contas · {data.usersWithAnyCapability} com alguma capacidade
                atribuída.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2">
              {Object.entries(data.perCapability).map(([cap, count]) => (
                <div
                  key={cap}
                  className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                >
                  <span>{CAPABILITY_LABELS[cap as Capability] ?? cap}</span>
                  <Badge variant="secondary">{count}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-3">
            {data.presets.map((p) => {
              const Icon = PRESET_ICON[p.key as PresetKey];
              return (
                <Card key={p.key} className="flex flex-col">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      {p.label}
                    </CardTitle>
                    <CardDescription>{p.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1 space-y-3">
                    <div className="flex flex-wrap gap-1.5">
                      {p.capabilities.map((c) => (
                        <Badge key={c} variant="outline" className="text-[11px]">
                          {CAPABILITY_LABELS[c]}
                        </Badge>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="rounded-md border p-2 text-center">
                        <div className="text-lg font-semibold">{p.matchingUsers}</div>
                        <div className="text-[11px] text-muted-foreground">com todas as caps</div>
                      </div>
                      <div className="rounded-md border p-2 text-center">
                        <div className="text-lg font-semibold">{p.partialUsers}</div>
                        <div className="text-[11px] text-muted-foreground">parciais</div>
                      </div>
                    </div>
                    {p.requiresSuperAdmin && (
                      <p className="text-[11px] text-amber-600 dark:text-amber-400">
                        Só o super admin pode aplicar este preset.
                      </p>
                    )}
                  </CardContent>
                  <div className="p-4 pt-0">
                    <Button
                      variant="secondary"
                      className="w-full"
                      onClick={() => setPresetOpen(p.key as PresetKey)}
                    >
                      Aplicar em massa
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {presetOpen && (
        <ApplyPresetDialog
          preset={presetOpen}
          onClose={() => setPresetOpen(null)}
        />
      )}
    </div>
  );
}

function ApplyPresetDialog({
  preset,
  onClose,
}: {
  preset: PresetKey;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const listFn = useServerFn(listPlatformUsers);
  const applyFn = useServerFn(applyCapabilityPreset);
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<"add" | "replace">("add");
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["platform-users-picker", search],
    queryFn: () =>
      listFn({
        data: { search: search || undefined, limit: 50, offset: 0 },
      }),
  });

  const rows = data?.rows ?? [];
  const selectedIds = useMemo(
    () => Object.keys(selected).filter((k) => selected[k]),
    [selected],
  );

  const apply = useMutation({
    mutationFn: () =>
      applyFn({ data: { preset, user_ids: selectedIds, mode } }),
    onSuccess: (r) => {
      toast.success(
        `Preset aplicado: ${r.users} usuário(s), +${r.granted} concedidas, -${r.revoked} revogadas.`,
      );
      qc.invalidateQueries({ queryKey: ["capabilities-overview"] });
      qc.invalidateQueries({ queryKey: ["platform-users"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message || "Falha ao aplicar preset"),
  });

  const presetLabelMap: Record<PresetKey, string> = {
    b2b: "JurisMind B2B (staff)",
    office_admin: "Admin de escritório",
    perito: "Perito",
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Aplicar preset: {presetLabelMap[preset]}</DialogTitle>
          <DialogDescription>
            Selecione os usuários que devem receber este conjunto de capacidades.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou escritório…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select value={mode} onValueChange={(v) => setMode(v as "add" | "replace")}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="add">Adicionar caps do preset</SelectItem>
              <SelectItem value="replace">Substituir (revoga o resto)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="max-h-[360px] overflow-auto rounded-md border">
          {isLoading ? (
            <p className="p-4 text-sm text-muted-foreground">Carregando…</p>
          ) : rows.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Nenhum usuário encontrado.</p>
          ) : (
            <ul className="divide-y">
              {rows.map((u: { id: string; full_name: string | null; firm_name: string | null; capabilities: Capability[] }) => (
                <li key={u.id} className="flex items-start gap-3 px-3 py-2 text-sm">
                  <Checkbox
                    checked={Boolean(selected[u.id])}
                    onCheckedChange={(v) =>
                      setSelected((prev) => ({ ...prev, [u.id]: Boolean(v) }))
                    }
                    className="mt-1"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{u.full_name ?? "(sem nome)"}</div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {u.firm_name ?? "—"} · {u.capabilities.length} cap(s)
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="text-[11px] text-muted-foreground">
          {selectedIds.length} usuário(s) selecionado(s).
          {mode === "replace" &&
            " Modo substituir remove as caps de escritório fora do preset."}
        </p>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={() => apply.mutate()}
            disabled={selectedIds.length === 0 || apply.isPending}
          >
            {apply.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            Aplicar em {selectedIds.length}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
