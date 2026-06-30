import { createFileRoute, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { useProfile } from "@/hooks/use-profile";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    if (!isLoading && !user) {
      navigate({ to: "/auth", replace: true });
    }
  }, [isLoading, user, navigate]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Gate de onboarding: roda só dentro da área autenticada.
  return (
    <OnboardingGate currentPath={pathname}>
      <DashboardShell>
        <Outlet />
      </DashboardShell>
    </OnboardingGate>
  );
}

function OnboardingGate({
  children,
  currentPath,
}: {
  children: React.ReactNode;
  currentPath: string;
}) {
  const { data: profile, isLoading } = useProfile();
  const navigate = useNavigate();
  const isOnboardingRoute = currentPath.startsWith("/onboarding");

  useEffect(() => {
    if (isLoading) return;
    if (!profile) return;
    if (!profile.onboarding_completed && !isOnboardingRoute) {
      navigate({ to: "/onboarding", replace: true });
    }
  }, [profile, isLoading, isOnboardingRoute, navigate]);

  if (isLoading || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Onboarding pendente: renderiza só o conteúdo (sem o shell completo).
  if (!profile.onboarding_completed && isOnboardingRoute) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-5xl px-4 md:px-6 lg:px-8 py-8">
          {/* O Outlet é renderizado dentro de children → DashboardShell;
              quando estamos só no onboarding queremos uma tela limpa. */}
          {children}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
