import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Building2, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  getFirmProfile,
  updateFirmProfile,
  setFirmLogo,
  removeFirmLogo,
  type EntityType,
} from "@/lib/firm-profile.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/settings/firm")({
  component: FirmSettingsPage,
});

const MAX_LOGO_MB = 2;
const ACCEPTED = ["image/png", "image/jpeg", "image/jpg"];

function FirmSettingsPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const getFn = useServerFn(getFirmProfile);
  const updateFn = useServerFn(updateFirmProfile);
  const setLogoFn = useServerFn(setFirmLogo);
  const removeLogoFn = useServerFn(removeFirmLogo);

  const { data, isLoading } = useQuery({
    queryKey: ["firm-profile"],
    queryFn: () => getFn(),
  });

  const [entityType, setEntityType] = useState<EntityType>("pessoa_fisica");
  const [firmName, setFirmName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [firmAddress, setFirmAddress] = useState("");
  const [firmWebsite, setFirmWebsite] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!data) return;
    setEntityType(data.entity_type);
    setFirmName(data.firm_name ?? "");
    setTaxId(data.tax_id ?? "");
    setFirmAddress(data.firm_address ?? "");
    setFirmWebsite(data.firm_website ?? "");
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () =>
      updateFn({
        data: {
          entity_type: entityType,
          firm_name: firmName.trim() || null,
          tax_id: taxId.trim() || null,
          firm_address: firmAddress.trim() || null,
          firm_website: firmWebsite.trim() || null,
        },
      }),
    onSuccess: () => {
      toast.success("Identidade atualizada");
      qc.invalidateQueries({ queryKey: ["firm-profile"] });
    },
    onError: (e) => toast.error(`Falha ao salvar: ${(e as Error).message}`),
  });

  const removeLogoMutation = useMutation({
    mutationFn: () => removeLogoFn(),
    onSuccess: () => {
      toast.success("Logo removido");
      qc.invalidateQueries({ queryKey: ["firm-profile"] });
    },
  });

  async function onPickLogo(file: File) {
    if (!user) return;
    if (!ACCEPTED.includes(file.type)) {
      toast.error("Envie PNG ou JPG.");
      return;
    }
    if (file.size > MAX_LOGO_MB * 1024 * 1024) {
      toast.error(`Arquivo maior que ${MAX_LOGO_MB}MB.`);
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${user.id}/logo-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("firm-logos")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      await setLogoFn({ data: { path } });
      toast.success("Logo enviado");
      qc.invalidateQueries({ queryKey: ["firm-profile"] });
    } catch (e) {
      toast.error(`Falha no upload: ${(e as Error).message}`);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4 sm:p-6">
      <Link
        to="/settings"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar para configurações
      </Link>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Building2 className="h-5 w-5" /> Identidade do escritório
          </CardTitle>
          <CardDescription>
            Estes dados aparecem no cabeçalho e rodapé de todos os documentos
            (.docx e PDF) exportados pelo B2B | JurisMind AI.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Logo</Label>
                <div className="flex items-center gap-4 rounded-lg border p-3">
                  <div className="flex h-16 w-32 items-center justify-center overflow-hidden rounded-md border bg-muted/40">
                    {data?.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={data.logo_url}
                        alt="Logo"
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Sem logo
                      </span>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-2 sm:flex-row">
                    <input
                      ref={fileRef}
                      type="file"
                      accept={ACCEPTED.join(",")}
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) onPickLogo(f);
                      }}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={uploading}
                      onClick={() => fileRef.current?.click()}
                    >
                      {uploading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="mr-2 h-4 w-4" />
                      )}
                      Enviar logo
                    </Button>
                    {data?.logo_url && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeLogoMutation.mutate()}
                        disabled={removeLogoMutation.isPending}
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Remover
                      </Button>
                    )}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  PNG ou JPG, até {MAX_LOGO_MB}MB. Ideal ~400×120 px.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select
                    value={entityType}
                    onValueChange={(v) => setEntityType(v as EntityType)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pessoa_fisica">
                        Pessoa física (advogado autônomo)
                      </SelectItem>
                      <SelectItem value="pessoa_juridica">
                        Pessoa jurídica (escritório/empresa)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>
                    {entityType === "pessoa_juridica"
                      ? "Razão social / Nome do escritório"
                      : "Nome exibido no cabeçalho"}
                  </Label>
                  <Input
                    value={firmName}
                    onChange={(e) => setFirmName(e.target.value)}
                    placeholder={
                      entityType === "pessoa_juridica"
                        ? "Ex.: Silva & Souza Advogados"
                        : "Ex.: Dr. João Silva"
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>
                    {entityType === "pessoa_juridica" ? "CNPJ" : "CPF / OAB"}
                  </Label>
                  <Input
                    value={taxId}
                    onChange={(e) => setTaxId(e.target.value)}
                    placeholder={
                      entityType === "pessoa_juridica"
                        ? "00.000.000/0001-00"
                        : "OAB/UF 000.000"
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Site</Label>
                  <Input
                    value={firmWebsite}
                    onChange={(e) => setFirmWebsite(e.target.value)}
                    placeholder="https://…"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Endereço</Label>
                  <Textarea
                    value={firmAddress}
                    onChange={(e) => setFirmAddress(e.target.value)}
                    rows={2}
                    placeholder="Rua, número, bairro, cidade – UF"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending}
                >
                  {saveMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Salvar
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
