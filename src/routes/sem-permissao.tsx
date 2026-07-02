import { createFileRoute, useSearch } from "@tanstack/react-router";
import { z } from "zod";
import { AccessDenied } from "@/components/access-denied";
import { CAPABILITIES, type Capability } from "@/lib/capabilities.functions";

const searchSchema = z.object({
  requires: z.enum(CAPABILITIES).optional(),
  from: z.string().optional(),
});

export const Route = createFileRoute("/sem-permissao")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Sem permissão — JurisMind AI" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SemPermissaoPage,
});

function SemPermissaoPage() {
  const { requires, from } = useSearch({ from: "/sem-permissao" }) as {
    requires?: Capability;
    from?: string;
  };
  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <AccessDenied requires={requires ?? null} attemptedPath={from} />
    </div>
  );
}
