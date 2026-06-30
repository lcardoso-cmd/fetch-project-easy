import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Configurações</h1>
        <p className="mt-1 text-muted-foreground">Gerencie seu perfil e preferências.</p>
      </div>
      <div className="rounded-xl border bg-card p-8 text-center shadow-sm">
        <p className="text-muted-foreground">Configurações em desenvolvimento.</p>
      </div>
    </div>
  );
}
