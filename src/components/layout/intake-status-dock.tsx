import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, FileSearch, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { listPendingIntakeDocuments } from "@/lib/intake.functions";
import {
  INTAKE_STATUS_LABEL,
  INTAKE_STATUS_PROGRESS,
  isIntakeActive,
  type IntakeStatus,
} from "@/lib/intake/intake-core";

export function IntakeStatusDock() {
  const listFn = useServerFn(listPendingIntakeDocuments);
  const query = useQuery({
    queryKey: ["pending-intake-documents"],
    queryFn: () => listFn(),
    refetchInterval: (state) => {
      const rows = state.state.data ?? [];
      return rows.some((row) => isIntakeActive(row.status)) ? 4_000 : false;
    },
  });

  const documents = useMemo(
    () => (query.data ?? []).filter((row) => row.status !== "cancelled" && row.status !== "converted"),
    [query.data],
  );
  if (documents.length === 0) return null;

  const activeCount = documents.filter((row) => isIntakeActive(row.status)).length;
  const hasError = documents.some((row) => row.status === "error");

  return (
    <div className="fixed bottom-20 right-4 z-40 lg:bottom-4 lg:right-[4.5rem]">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            size="icon"
            variant="secondary"
            className="relative size-12 rounded-full border shadow-lg"
            aria-label="Acompanhar análise do novo caso"
          >
            {activeCount > 0 ? (
              <Loader2 className="size-5 animate-spin" />
            ) : hasError ? (
              <AlertTriangle className="size-5 text-destructive" />
            ) : (
              <CheckCircle2 className="size-5" />
            )}
            <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
              {documents.length}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent side="top" align="end" className="w-[min(22rem,calc(100vw-2rem))] p-3">
          <div className="mb-3 flex items-center gap-2">
            <FileSearch className="size-4 text-primary" />
            <p className="text-sm font-semibold">Análise do novo caso</p>
          </div>
          <div className="space-y-3">
            {documents.map((row) => {
              const status = row.status as IntakeStatus;
              const active = isIntakeActive(status);
              return (
                <div key={row.id} className="space-y-2 border-t pt-3 first:border-t-0 first:pt-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium" title={row.filename}>{row.filename}</p>
                      <p className={row.status === "error" ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>
                        {INTAKE_STATUS_LABEL[status] ?? "Aguardando análise"}
                      </p>
                    </div>
                    {active && <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-primary" />}
                  </div>
                  <Progress value={INTAKE_STATUS_PROGRESS[status] ?? 10} className="h-1.5" />
                  <Button asChild size="sm" variant="outline" className="w-full">
                    <Link to="/assistencias/nova">Retomar cadastro</Link>
                  </Button>
                </div>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}