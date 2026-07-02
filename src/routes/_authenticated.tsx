import { createFileRoute, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { useProfile } from "@/hooks/use-profile";
import { useCapabilities } from "@/hooks/use-capabilities";
import { requiredCapabilityForPath } from "@/lib/route-capabilities";
import { AccessDenied } from "@/components/access-denied";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    if (!isLoading && !user) {
      navigate({ to: "/entrar", replace: true });
    }
  }, [isLoading, user, navigate]);

  if (isLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return <Gate path={pathname} />;
}

function Gate({ path }: { path: string }) {
  const { data: profile, isLoading } = useProfile();
  const navigate = useNavigate();
  const isOnboarding = path.startsWith("/boas-vindas");

  useEffect(() => {
    if (isLoading || !profile) return;
    if (!profile.onboarding_completed && !isOnboarding) {
      navigate({ to: "/boas-vindas", replace: true });
    }
  }, [profile, isLoading, isOnboarding, navigate]);

  if (isLoading || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Onboarding ainda pendente → tela limpa, sem o shell.
  if (!profile.onboarding_completed) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-5xl px-4 md:px-6 lg:px-8 py-8">
          <Outlet />
        </div>
      </div>
    );
  }

  // Onboarding já concluído mas o usuário voltou para editar perfil → mantemos o shell.
  return (
    <DashboardShell>
      <GatedOutlet path={path} />
    </DashboardShell>
  );
}

function GatedOutlet({ path }: { path: string }) {
  const required = requiredCapabilityForPath(path);
  const { has, isLoading } = useCapabilities();
  if (!required) return <Outlet />;
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!has(required)) {
    return <AccessDenied requires={required} attemptedPath={path} />;
  }
  return <Outlet />;
}
