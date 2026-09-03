/** Componentes compartilhados do backoffice comercial B2B. */
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  INVOICE_STATUS_LABELS,
  ORG_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  SUBSCRIPTION_STATUS_LABELS,
  formatMoneyCents,
} from "@/lib/billing-shared";

export function BackToPlatform({ label = "Plataforma" }: { label?: string }) {
  return (
    <Link
      to="/plataforma"
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="h-3.5 w-3.5" /> {label}
    </Link>
  );
}

const TONE: Record<string, string> = {
  ok: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  warn: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  danger: "bg-red-500/15 text-red-700 dark:text-red-300",
  muted: "bg-muted text-muted-foreground",
};

function tone(status: string): string {
  if (["active", "paid", "succeeded"].includes(status)) return TONE["ok"]!;
  if (["trial", "trialing", "open", "draft", "pending"].includes(status)) return TONE["warn"]!;
  if (["past_due", "suspended", "overdue", "failed"].includes(status)) return TONE["danger"]!;
  return TONE["muted"]!;
}

export function StatusPill({
  status,
  kind,
}: {
  status: string | null | undefined;
  kind: "organization" | "subscription" | "invoice" | "payment";
}) {
  if (!status) return <span className="text-muted-foreground">—</span>;
  const labels =
    kind === "organization"
      ? ORG_STATUS_LABELS
      : kind === "subscription"
        ? SUBSCRIPTION_STATUS_LABELS
        : kind === "invoice"
          ? INVOICE_STATUS_LABELS
          : PAYMENT_STATUS_LABELS;
  const label = (labels as Record<string, string>)[status] ?? status;
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${tone(status)}`}>
      {label}
    </span>
  );
}

export function KpiCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          {icon} {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
        {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export function Money({ cents, currency }: { cents: number; currency?: string }) {
  return <span className="tabular-nums">{formatMoneyCents(cents, currency ?? "BRL")}</span>;
}

export function EmptyRow({ colSpan, children }: { colSpan: number; children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-10 text-center text-sm text-muted-foreground">
        {children}
      </td>
    </tr>
  );
}

export function ProviderBadge({ provider }: { provider: string | null }) {
  if (!provider) return <span className="text-muted-foreground">—</span>;
  return (
    <Badge variant="outline" className="text-xs">
      {provider === "manual" ? "Contrato manual" : "Pagamento online"}
    </Badge>
  );
}

export function dateBR(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("pt-BR");
}
