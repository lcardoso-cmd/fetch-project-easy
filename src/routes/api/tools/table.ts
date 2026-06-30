import { createFileRoute } from "@tanstack/react-router";
import * as XLSX from "xlsx";

function sanitize(name: string) {
  return (
    name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^\w-.]/g, "")
      .replace(/_{2,}/g, "_") || "tabela"
  );
}

export const Route = createFileRoute("/api/tools/table")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { titulo = "tabela", rows } = (await request.json()) as {
            titulo?: string;
            rows?: Array<Record<string, unknown>>;
          };
          if (!rows || !Array.isArray(rows)) {
            return new Response("rows obrigatório (array)", { status: 400 });
          }
          const wb = XLSX.utils.book_new();
          let ws;
          if (rows.length === 0) {
            ws = XLSX.utils.aoa_to_sheet([["Sem dados"]]);
          } else {
            const headers = new Set<string>();
            for (const r of rows)
              if (r && typeof r === "object") Object.keys(r).forEach((k) => headers.add(k));
            const cols = Array.from(headers);
            const normalized = rows.map((r) => {
              const o: Record<string, unknown> = {};
              for (const c of cols) o[c] = r?.[c] ?? "";
              return o;
            });
            ws = XLSX.utils.json_to_sheet(normalized, { header: cols });
          }
          XLSX.utils.book_append_sheet(wb, ws, "Dados");
          const buf = XLSX.write(wb, { bookType: "xlsx", type: "buffer" }) as Buffer;
          return new Response(new Uint8Array(buf), {
            status: 200,
            headers: {
              "Content-Type":
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              "Content-Disposition": `attachment; filename="${sanitize(titulo)}.xlsx"`,
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
