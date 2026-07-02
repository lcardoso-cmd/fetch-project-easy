import { createFileRoute } from "@tanstack/react-router";

/**
 * Transcrição parcial em tempo real.
 * Recebe um segmento WAV auto-contido (base64) e faz passthrough do
 * stream SSE do Lovable AI Gateway (`openai/gpt-4o-mini-transcribe`).
 *
 * Body: { audio_base64: string, format?: string }
 * Response: text/event-stream com eventos `transcript.text.delta` e
 * `transcript.text.done` (formato OpenAI).
 */
export const Route = createFileRoute("/api/tools/transcribe-stream")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as {
            audio_base64?: string;
            format?: string;
          };
          const audio = body.audio_base64;
          const format = (body.format ?? "wav").toLowerCase();
          if (!audio || typeof audio !== "string") {
            return new Response(
              JSON.stringify({ error: "audio_base64 obrigatório" }),
              {
                status: 400,
                headers: { "Content-Type": "application/json" },
              },
            );
          }

          const key = process.env.LOVABLE_API_KEY;
          if (!key) {
            return new Response(
              JSON.stringify({ error: "LOVABLE_API_KEY ausente" }),
              {
                status: 500,
                headers: { "Content-Type": "application/json" },
              },
            );
          }

          // Decodifica base64 -> Uint8Array -> Blob para multipart
          const bin = atob(audio);
          const bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          const mime =
            format === "mp3"
              ? "audio/mp3"
              : format === "webm"
                ? "audio/webm"
                : format === "m4a"
                  ? "audio/m4a"
                  : "audio/wav";
          const fileBlob = new Blob([bytes], { type: mime });

          const upstream = new FormData();
          upstream.append("model", "openai/gpt-4o-mini-transcribe");
          upstream.append("file", fileBlob, `segment.${format}`);
          upstream.append("stream", "true");

          const res = await fetch(
            "https://ai.gateway.lovable.dev/v1/audio/transcriptions",
            {
              method: "POST",
              headers: { Authorization: `Bearer ${key}` },
              body: upstream,
              signal: request.signal,
            },
          );

          if (!res.ok || !res.body) {
            const txt = await res.text().catch(() => "");
            return new Response(
              JSON.stringify({
                error: `Transcrição falhou (${res.status})`,
                detail: txt.slice(0, 400),
              }),
              {
                status: res.status || 500,
                headers: { "Content-Type": "application/json" },
              },
            );
          }

          // Passthrough do SSE
          return new Response(res.body, {
            status: 200,
            headers: {
              "Content-Type": "text/event-stream; charset=utf-8",
              "Cache-Control": "no-cache, no-transform",
              Connection: "keep-alive",
            },
          });
        } catch (e) {
          const isAbort =
            (e as { name?: string })?.name === "AbortError";
          if (isAbort) {
            return new Response(null, { status: 499 });
          }
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
