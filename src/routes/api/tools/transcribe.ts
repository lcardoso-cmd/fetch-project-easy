import { createFileRoute } from "@tanstack/react-router";

/**
 * Recebe áudio base64 (webm/wav/mp3/m4a/ogg) e retorna a transcrição em
 * português via Gemini (Lovable AI Gateway). Uso: STT do chat JurisMind.
 */
export const Route = createFileRoute("/api/tools/transcribe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as {
            audio_base64?: string;
            format?: string;
            language?: string;
          };
          const audio = body.audio_base64;
          const format = (body.format ?? "webm").toLowerCase();
          if (!audio || typeof audio !== "string") {
            return new Response(
              JSON.stringify({ error: "audio_base64 obrigatório" }),
              { status: 400, headers: { "Content-Type": "application/json" } },
            );
          }
          const key = process.env.LOVABLE_API_KEY;
          if (!key) {
            return new Response(
              JSON.stringify({ error: "LOVABLE_API_KEY ausente" }),
              { status: 500, headers: { "Content-Type": "application/json" } },
            );
          }

          const res = await fetch(
            "https://ai.gateway.lovable.dev/v1/chat/completions",
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${key}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "google/gemini-2.5-flash",
                temperature: 0,
                messages: [
                  {
                    role: "system",
                    content:
                      "Você é um transcritor. Transcreva literalmente o áudio em português brasileiro, sem comentários e sem tradução. Se houver múltiplos falantes, transcreva em ordem. Se o áudio estiver vazio ou inaudível, responda 'transcrição indisponível'.",
                  },
                  {
                    role: "user",
                    content: [
                      {
                        type: "input_audio",
                        input_audio: { data: audio, format },
                      },
                      {
                        type: "text",
                        text: `Transcreva o áudio em ${body.language ?? "pt-BR"}.`,
                      },
                    ],
                  },
                ],
              }),
            },
          );

          if (!res.ok) {
            const txt = await res.text();
            return new Response(
              JSON.stringify({ error: `Transcrição falhou (${res.status})`, detail: txt.slice(0, 400) }),
              { status: 500, headers: { "Content-Type": "application/json" } },
            );
          }
          const json = (await res.json()) as {
            choices?: { message?: { content?: string } }[];
          };
          const text = json.choices?.[0]?.message?.content?.trim() ?? "";
          return new Response(JSON.stringify({ text }), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return new Response(JSON.stringify({ error: msg }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
