import { createFileRoute } from "@tanstack/react-router";
import pptxgen from "pptxgenjs";

function sanitize(name: string) {
  return (
    name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^\w-.]/g, "")
      .replace(/_{2,}/g, "_") || "apresentacao"
  );
}

interface SlideIn {
  title?: string;
  content?: string[];
}

export const Route = createFileRoute("/api/tools/presentation")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { title, subtitle, slides } = (await request.json()) as {
            title?: string;
            subtitle?: string;
            slides?: SlideIn[];
          };
          if (!title || !slides || !Array.isArray(slides)) {
            return new Response("title e slides obrigatórios", { status: 400 });
          }
          const pres = new pptxgen();
          pres.layout = "LAYOUT_16x9";
          pres.defineSlideMaster({
            title: "MASTER",
            background: { color: "F1F1F1" },
            objects: [
              { rect: { x: 0, y: "92%", w: "100%", h: "8%", fill: { color: "000038" } } },
              {
                text: {
                  text: "JurisMind AI",
                  options: {
                    x: "3%",
                    y: "92%",
                    w: "94%",
                    align: "right",
                    color: "FFFFFF",
                    fontSize: 10,
                  },
                },
              },
            ],
          });
          const titleSlide = pres.addSlide();
          titleSlide.background = { color: "000038" };
          titleSlide.addText(String(title), {
            x: "10%",
            y: "30%",
            w: "80%",
            h: "20%",
            align: "center",
            fontSize: 40,
            bold: true,
            color: "FFFFFF",
          });
          if (subtitle) {
            titleSlide.addText(String(subtitle), {
              x: "10%",
              y: "55%",
              w: "80%",
              h: "10%",
              align: "center",
              fontSize: 22,
              color: "00FFFF",
            });
          }
          for (const s of slides) {
            const sl = pres.addSlide({ masterName: "MASTER" });
            sl.addText(String(s.title ?? ""), {
              x: "5%",
              y: "5%",
              w: "90%",
              h: "12%",
              fontSize: 26,
              bold: true,
              color: "000038",
            });
            const points = Array.isArray(s.content) ? s.content : [];
            if (points.length) {
              sl.addText(
                points.map((p) => ({ text: String(p), options: { bullet: true } })),
                {
                  x: "8%",
                  y: "22%",
                  w: "84%",
                  h: "65%",
                  fontSize: 18,
                  color: "333333",
                },
              );
            }
          }
          const out = (await pres.write({ outputType: "nodebuffer" })) as Buffer;
          return new Response(new Uint8Array(out), {
            status: 200,
            headers: {
              "Content-Type":
                "application/vnd.openxmlformats-officedocument.presentationml.presentation",
              "Content-Disposition": `attachment; filename="${sanitize(title)}.pptx"`,
            },
          });
        } catch (e) {
          return new Response(`Erro: ${e instanceof Error ? e.message : String(e)}`, {
            status: 500,
          });
        }
      },
    },
  },
});
