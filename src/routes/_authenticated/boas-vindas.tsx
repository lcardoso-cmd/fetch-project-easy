import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Scale, Loader2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { completeOnboarding } from "@/lib/profile.functions";
import { useProfile } from "@/hooks/use-profile";

export const Route = createFileRoute("/_authenticated/boas-vindas")({
  component: OnboardingPage,
});

function OnboardingPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const completeFn = useServerFn(completeOnboarding);
  const { data: profile, isLoading } = useProfile();

  const [fullName, setFullName] = useState("");

  // Se já completou o onboarding, redireciona pro painel.
  useEffect(() => {
    if (profile?.onboarding_completed) {
      navigate({ to: "/painel", replace: true });
    }
  }, [profile?.onboarding_completed, navigate]);

  useEffect(() => {
    if (profile) setFullName(profile.full_name ?? "");
  }, [profile]);

  const mut = useMutation({
    mutationFn: () =>
      completeFn({
        data: { full_name: fullName.trim() || null },
      }),
    onSuccess: () => {
      toast.success("Perfil configurado");
      qc.invalidateQueries({ queryKey: ["profile"] });
      navigate({ to: "/painel" });
    },
    onError: (e: Error) => toast.error(e.message || "Falha ao salvar"),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 py-6">
      <div className="text-center space-y-2">
        <Badge variant="secondary" className="mb-2">Boas-vindas ao JurisMind</Badge>
        <h1 className="text-3xl font-bold font-heading tracking-tight">
          Vamos preparar seu espaço
        </h1>
        <p className="text-muted-foreground">
          O JurisMind é feito para escritórios de advocacia. Em poucos segundos você já
          começa a usar peças, propostas, agenda e marketing jurídico.
        </p>
      </div>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex items-start gap-3 rounded-xl border bg-muted/30 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent">
              <Scale className="h-5 w-5" />
            </div>
            <div>
              <p className="font-medium">Escritório de advocacia</p>
              <p className="text-xs text-muted-foreground">
                Vocabulário, campos e modelos otimizados para a atuação jurídica.
              </p>
            </div>
          </div>

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

          <div className="flex justify-end pt-2">
            <Button
              onClick={() => mut.mutate()}
              disabled={mut.isPending}
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
