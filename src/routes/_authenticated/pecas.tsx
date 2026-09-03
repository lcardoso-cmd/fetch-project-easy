import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { PieceGenerator } from "@/components/generators/piece-generator";

export const Route = createFileRoute("/_authenticated/pecas")({
  component: DrafterPage,
});

function DrafterPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Gerador de documentos"
        subtitle="Minutas redigidas a partir dos documentos já processados do caso."
      />
      <PieceGenerator />
    </div>
  );
}
