import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Scale,
  Gavel,
  Search,
  Loader2,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { completeOnboarding, type PracticeType } from "@/lib/profile.functions";
import {
  PRACTICE_TYPE_DESCRIPTIONS,
  PRACTICE_TYPE_LABELS,
  SPECIALTY_SUGGESTIONS,
} from "@/lib/practice-labels";
import { useProfile } from "@/hooks/use-profile";

export const Route = createFileRoute("/_authenticated/boas-vindas")({
  component: OnboardingPage,
});

const OPTIONS: { value: PracticeType; icon: typeof Scale }[] = [
  { value: "advogado", icon: Scale },
  { value: "perito_judicial", icon: Gavel },
  { value: "assistente_tecnico", icon: Search },
];

function OnboardingPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const completeFn = useServerFn(completeOnboarding);
  const { data: profile, isLoading } = useProfile();

  const [practice, setPractice] = useState<PracticeType | null>(null);
  const [specialty, setSpecialty] = useState("");
  const [fullName, setFullName] = useState("");

  // Se já completou o onboarding, redireciona pro painel.
  useEffect(() => {
    if (profile?.onboarding_completed) {
      navigate({ to: "/painel", replace: true });
    }
  }, [profile?.onboarding_completed, navigate]);

  // Pré-preenche com valores existentes se vier de "editar perfil".
  useEffect(() => {
    if (profile) {
      setPractice((profile.practice_type as PracticeType) ?? null);
      setSpecialty(profile.specialty ?? "");
      setFullName(profile.full_name ?? "");
    }
  }, [profile]);

  const mut = useMutation({
    mutationFn: () =>
      completeFn({
        data: {
          practice_type: practice!,
          specialty: practice === "advogado" ? null : specialty.trim() || null,
          full_name: fullName.trim() || null,
        },
      }),
    onSuccess: () => {
      toast.success("Perfil configurado");
      qc.invalidateQueries({ queryKey: ["profile"] });
      navigate({ to: "/painel" });
    },
    onError: (e: Error) => toast.error(e.message || "Falha ao salvar"),
  });

  const needsSpecialty = practice && practice !== "advogado";
  const canSubmit = !!practice && (!needsSpecialty || specialty.trim().length > 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 py-6">
      <div className="text-center space-y-2">
        <Badge variant="secondary" className="mb-2">Boas-vindas ao JurisMind</Badge>
        <h1 className="text-3xl font-bold font-heading tracking-tight">
          Como você atua?
        </h1>
        <p className="text-muted-foreground">
          O JurisMind adapta vocabulário, campos e modelos de documentos para o seu perfil.
          Você pode trocar caso a caso depois.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {OPTIONS.map(({ value, icon: Icon }) => {
          const selected = practice === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setPractice(value)}
              className={`text-left rounded-xl border p-4 transition-all ${
                selected
                  ? "border-accent ring-2 ring-accent/40 bg-accent/5"
                  : "border-border hover:border-accent/40"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent">
                  <Icon className="h-5 w-5" />
                </div>
                {selected && <CheckCircle2 className="h-5 w-5 text-accent" />}
              </div>
              <p className="font-medium">{PRACTICE_TYPE_LABELS[value]}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {PRACTICE_TYPE_DESCRIPTIONS[value]}
              </p>
            </button>
          );
        })}
      </div>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="space-y-2">
            <Label htmlFor="full_name">Seu nome (opcional)</Label>
            <Input
              id="full_name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              maxLength={160}
              placeholder="Como você quer ser chamado(a)"
            />
          </div>

          {needsSpecialty && (
            <div className="space-y-2">
              <Label htmlFor="specialty">Especialidade *</Label>
              <Input
                id="specialty"
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                maxLength={120}
                placeholder="Ex.: Contábil, Engenharia civil, Médica..."
              />
              <div className="flex flex-wrap gap-1.5">
                {SPECIALTY_SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSpecialty(s)}
                    className={`text-xs rounded-full border px-2.5 py-1 transition-colors ${
                      specialty === s
                        ? "border-accent bg-accent text-accent-foreground"
                        : "border-border text-muted-foreground hover:border-accent/40"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button
              onClick={() => mut.mutate()}
              disabled={!canSubmit || mut.isPending}
              size="lg"
            >
              {mut.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ArrowRight className="mr-2 h-4 w-4" />
              )}
              Começar a usar o JurisMind
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
