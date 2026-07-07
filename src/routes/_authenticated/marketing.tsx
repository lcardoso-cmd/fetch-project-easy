import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Megaphone, Loader2, Copy, Download, Image as ImageIcon, MessageCircle, RefreshCw, FileText } from "lucide-react";
import { toast } from "sonner";
import { generateMarketing, generateMarketingImages } from "@/lib/generators.functions";
import { RichTextEditor } from "@/components/chat/rich-text-editor";
import { markdownToHtml } from "@/lib/markdown-to-html";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/marketing")({
  component: MarketingPage,
});

type Format = "post-linkedin" | "post-instagram" | "artigo-blog" | "newsletter";
type Tone = "autoridade" | "educativo" | "provocativo" | "acolhedor";

async function downloadFromApi(url: string, body: unknown, filename: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token) headers.Authorization = `Bearer ${token}`;
  } catch {
    /* segue */
  }
  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  if (!res.ok) {
    toast.error(`Falha ao gerar arquivo (${res.status})`);
    return;
  }
  const blob = await res.blob();
  const objUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objUrl);
}

function b64ToBlob(b64: string, mime = "image/png"): Blob {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function downloadBlobAs(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function sendToWhatsApp(text: string, imageB64: string, filename: string) {
  const blob = b64ToBlob(imageB64);
  // Se o navegador suportar Web Share Level 2 com arquivos (mobile PWA), usa share nativo.
  const file = new File([blob], filename, { type: "image/png" });
  const nav = navigator as Navigator & {
    canShare?: (data: { files?: File[] }) => boolean;
    share?: (data: { title?: string; text?: string; files?: File[] }) => Promise<void>;
  };
  if (nav.canShare && nav.canShare({ files: [file] }) && nav.share) {
    try {
      await nav.share({ text, files: [file] });
      return;
    } catch {
      /* usuário cancelou ou falhou — cai no fallback */
    }
  }
  // Fallback desktop: baixa a imagem, copia o texto e abre wa.me com o texto.
  downloadBlobAs(blob, filename);
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    /* ok */
  }
  const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(url, "_blank", "noopener,noreferrer");
  toast.info("Imagem baixada e texto copiado", {
    description: "Anexe a imagem manualmente no WhatsApp — o texto já está na sua área de transferência.",
  });
}

function ImageArtCard({
  title,
  aspectClass,
  b64,
  filename,
  captionText,
}: {
  title: string;
  aspectClass: string;
  b64: string;
  filename: string;
  captionText: string;
}) {
  const src = `data:image/png;base64,${b64}`;
  return (
    <div className="rounded-lg border bg-background p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold">{title}</p>
      </div>
      <div className={`${aspectClass} mx-auto w-full max-w-2xl overflow-hidden rounded-md border bg-muted`}>
        <img src={src} alt={title} className="h-full w-full object-cover" />
      </div>
      <div className="mt-4 flex flex-wrap justify-center gap-3">
        <Button
          variant="outline"
          onClick={() => downloadBlobAs(b64ToBlob(b64), filename)}
        >
          <Download className="mr-2 h-4 w-4" /> Baixar PNG
        </Button>
        <Button onClick={() => sendToWhatsApp(captionText, b64, filename)}>
          <MessageCircle className="mr-2 h-4 w-4" /> Enviar por WhatsApp
        </Button>
      </div>
    </div>
  );
}

function MarketingPage() {
  const gen = useServerFn(generateMarketing);
  const genImages = useServerFn(generateMarketingImages);
  const [loading, setLoading] = useState(false);
  const [loadingImages, setLoadingImages] = useState(false);
  const [outputHtml, setOutputHtml] = useState("");
  const [images, setImages] = useState<{ i16: string; i9: string } | null>(null);
  const [form, setForm] = useState<{
    topic: string;
    format: Format;
    audience: string;
    tone: Tone;
  }>({
    topic: "",
    format: "post-linkedin",
    audience: "clientes empresariais",
    tone: "educativo",
  });

  const captionText = useMemo(
    () => outputHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
    [outputHtml],
  );

  const generateImagesFor = async (topic: string, tone: Tone) => {
    setLoadingImages(true);
    setImages(null);
    try {
      const r = await genImages({ data: { topic, tone } });
      setImages({ i16: r.image_16x9_b64, i9: r.image_9x16_b64 });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao gerar imagens");
    } finally {
      setLoadingImages(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.topic.trim()) {
      toast.error("Informe o tema");
      return;
    }
    setLoading(true);
    setOutputHtml("");
    setImages(null);
    try {
      const r = await gen({ data: form });
      setOutputHtml(markdownToHtml(r.content));
      // Dispara imagens em paralelo, mas não bloqueia o texto.
      void generateImagesFor(form.topic, form.tone);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao gerar");
    } finally {
      setLoading(false);
    }
  };

  const filenameBase = form.topic.trim().slice(0, 40).replace(/[^\w\-]+/g, "-").replace(/^-+|-+$/g, "") || "post";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-heading tracking-tight">Marketing Jurídico</h1>
        <p className="mt-1 text-muted-foreground">
          Gerador alinhado ao Provimento 205/2021 da OAB — texto editável + artes 16:9 e 9:16 prontas para publicar.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="font-heading flex items-center gap-2">
              <Megaphone className="h-5 w-5" /> Briefing
            </CardTitle>
            <CardDescription>Tema + formato + tom.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <Label>Tema</Label>
                <Textarea
                  rows={3}
                  value={form.topic}
                  onChange={(e) => setForm({ ...form, topic: e.target.value })}
                  placeholder="Ex: novidades da reforma tributária para PMEs"
                />
              </div>
              <div>
                <Label>Formato</Label>
                <Select
                  value={form.format}
                  onValueChange={(v) => setForm({ ...form, format: v as Format })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="post-linkedin">Post LinkedIn</SelectItem>
                    <SelectItem value="post-instagram">Post Instagram</SelectItem>
                    <SelectItem value="artigo-blog">Artigo de blog</SelectItem>
                    <SelectItem value="newsletter">Newsletter</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Público</Label>
                <Input
                  value={form.audience}
                  onChange={(e) => setForm({ ...form, audience: e.target.value })}
                />
              </div>
              <div>
                <Label>Tom</Label>
                <Select value={form.tone} onValueChange={(v) => setForm({ ...form, tone: v as Tone })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="autoridade">Autoridade</SelectItem>
                    <SelectItem value="educativo">Educativo</SelectItem>
                    <SelectItem value="provocativo">Provocativo</SelectItem>
                    <SelectItem value="acolhedor">Acolhedor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Gerando...
                  </>
                ) : (
                  "Gerar conteúdo + artes"
                )}
              </Button>
              {outputHtml && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={loadingImages || !form.topic.trim()}
                  onClick={() => generateImagesFor(form.topic, form.tone)}
                >
                  {loadingImages ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Regerando imagens...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Regerar imagens
                    </>
                  )}
                </Button>
              )}
            </form>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="font-heading flex items-center gap-2">
                  <FileText className="h-5 w-5" /> Conteúdo
                </CardTitle>
                <CardDescription>Editável — ajuste antes de publicar ou exportar.</CardDescription>
              </div>
              {outputHtml && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(captionText);
                      toast.success("Texto copiado");
                    }}
                  >
                    <Copy className="mr-1.5 h-4 w-4" /> Copiar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      downloadFromApi(
                        "/api/tools/pdf",
                        { titulo: form.topic || "Post", html: outputHtml },
                        `${filenameBase}.pdf`,
                      )
                    }
                  >
                    <Download className="mr-1.5 h-4 w-4" /> PDF
                  </Button>
                  <Button
                    size="sm"
                    onClick={() =>
                      downloadFromApi(
                        "/api/tools/petition",
                        { titulo: form.topic || "Post", html: outputHtml },
                        `${filenameBase}.docx`,
                      )
                    }
                  >
                    <Download className="mr-1.5 h-4 w-4" /> Word
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {outputHtml ? (
                <RichTextEditor html={outputHtml} onChange={setOutputHtml} minHeight={320} />
              ) : (
                <p className="text-sm text-muted-foreground">O conteúdo gerado aparecerá aqui.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-heading flex items-center gap-2">
                <ImageIcon className="h-5 w-5" /> Artes para publicação
              </CardTitle>
              <CardDescription>
                Fundos sóbrios gerados por IA — 16:9 para LinkedIn/blog e 9:16 para stories/reels.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingImages && !images && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Gerando artes 16:9 e 9:16...
                </div>
              )}
              {!loadingImages && !images && (
                <p className="text-sm text-muted-foreground">
                  As artes aparecerão aqui após gerar o conteúdo.
                </p>
              )}
              {images && (
                <div className="grid gap-4 md:grid-cols-2">
                  <ImageArtCard
                    title="Feed / LinkedIn (16:9)"
                    aspectClass="aspect-video"
                    b64={images.i16}
                    filename={`${filenameBase}-16x9.png`}
                    captionText={captionText}
                  />
                  <ImageArtCard
                    title="Story / Reels (9:16)"
                    aspectClass="aspect-[9/16] max-h-[420px]"
                    b64={images.i9}
                    filename={`${filenameBase}-9x16.png`}
                    captionText={captionText}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
