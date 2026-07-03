import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getFirmProfile } from "@/lib/firm-profile.functions";
import { sanitizeProposalHtml } from "@/lib/sanitize-html";


/**
 * WordPreview — página em formato US Letter que espelha o template DOCX
 * (src/lib/docx/template.ts) para conferência visual antes do export.
 * A paginação real é gerada pelo Word; aqui rolamos numa única página.
 */
interface WordPreviewProps {
  html: string;
  title: string;
  headerLabel?: string;
}

// 8.5in × 11in em pixels (96dpi CSS)
const PAGE_W = 816;
const PAGE_H = 1056;

export function WordPreview({ html, title, headerLabel = "Proposta comercial" }: WordPreviewProps) {
  const getFirmFn = useServerFn(getFirmProfile);
  const { data: firm } = useQuery({
    queryKey: ["firm-profile"],
    queryFn: () => getFirmFn(),
    staleTime: 60_000,
  });
  const brandName = firm?.firm_name?.trim() || firm?.full_name?.trim() || "B2B | JurisMind AI";
  const footerLeft = [
    firm?.firm_name?.trim() || "Documento gerado por B2B | JurisMind AI",
    firm?.tax_id?.trim(),
    firm?.firm_website?.trim(),
  ]
    .filter(Boolean)
    .join(" · ");
  const shellRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const safeHtml = useMemo(() => sanitizeProposalHtml(html) || "<p></p>", [html]);


  useEffect(() => {
    if (!shellRef.current) return;
    const el = shellRef.current;
    const measure = () => {
      const w = el.clientWidth;
      // 32px de padding lateral respirando dentro do card
      const target = Math.min(1, (w - 32) / PAGE_W);
      setScale(Math.max(0.35, target));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={shellRef}
      className="w-full overflow-auto rounded-md border bg-muted/40 p-4"
      style={{ maxHeight: 640 }}
    >
      <div
        className="mx-auto"
        style={{
          width: PAGE_W * scale,
          height: PAGE_H * scale,
          position: "relative",
        }}
      >
        <div
          className="word-page"
          style={{
            width: PAGE_W,
            height: PAGE_H,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        >
          {/* Cabeçalho */}
          <div className="word-page__header">
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {firm?.logo_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={firm.logo_url}
                  alt=""
                  style={{ maxHeight: 40, maxWidth: 160, objectFit: "contain" }}
                />
              )}
              <span className="word-page__brand">{brandName}</span>
            </div>
            <span className="word-page__header-label">{headerLabel}</span>
          </div>

          {/* Conteúdo */}
          <div className="word-page__body">
            <h1 className="word-title">{title}</h1>
            <div
              className="word-doc"
              dangerouslySetInnerHTML={{ __html: safeHtml }}
            />


          </div>

          {/* Rodapé */}
          <div className="word-page__footer">
            <span>{footerLeft}</span>
            <span>Página 1</span>
          </div>
        </div>
      </div>

      <p className="mt-3 text-center text-[11px] text-muted-foreground">
        Prévia aproximada. A paginação real é gerada pelo Word ao abrir o arquivo.
      </p>
    </div>
  );
}
