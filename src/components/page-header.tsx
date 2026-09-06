import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

/**
 * Escala institucional: título de página 28px (text-page-title), subtítulo 16px
 * com largura de leitura confortável. Sem card ao redor; ações à direita.
 */
export function PageHeader({ title, subtitle, actions, className }: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="text-page-title text-balance break-words text-foreground">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-2 text-base prose-measure text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2 sm:shrink-0 [&>*]:min-w-0 [&_button]:whitespace-nowrap [&_a]:whitespace-nowrap">
          {actions}
        </div>
      ) : null}
    </header>
  );
}

