import { createFileRoute } from "@tanstack/react-router";
import { buildPitchDeckPdf } from "@/lib/marketing/deck-pdf.server";

/**
 * Apresentação comercial (16:9) gerada a partir do mesmo conteúdo da homepage.
 * Endpoint público e sem dados de cliente — pensado para envio a prospects.
 */
export const Route = createFileRoute("/api/public/deck")({
  server: {
    handlers: {
      GET: async () => {
        const bytes = await buildPitchDeckPdf();
        return new Response(bytes as unknown as BodyInit, {
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": 'attachment; filename="JurisMind-Apresentacao.pdf"',
            "Cache-Control": "public, max-age=300",
          },
        });
      },
    },
  },
});
