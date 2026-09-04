import { createFileRoute } from "@tanstack/react-router";
import deckAsset from "@/assets/jurismind-apresentacao.pdf.asset.json";

/**
 * Apresentação comercial (16:9) do JurisMind.
 * Endpoint público e sem dados de cliente — redireciona para o PDF estático
 * oficial, o mesmo arquivo servido pelo botão de download da homepage.
 */
export const Route = createFileRoute("/api/public/deck")({
  server: {
    handlers: {
      GET: async () => {
        return new Response(null, {
          status: 302,
          headers: {
            Location: deckAsset.url,
            "Cache-Control": "public, max-age=300",
          },
        });
      },
    },
  },
});
