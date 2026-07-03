import { Component, type ErrorInfo, type ReactNode } from "react";
import { ErrorFallback } from "./error-fallback";
import { reportLovableError } from "@/lib/lovable-error-reporting";

interface Props {
  children: ReactNode;
  /** Rótulo do boundary para logs/telemetria. */
  boundary?: string;
}

interface State {
  error: Error | null;
}

/**
 * React Error Boundary global. Captura erros de renderização que estão fora
 * do fluxo de loader do TanStack Router (ex.: erros em Providers, hooks, ou
 * componentes filhos), garantindo uma tela amigável em todo o app.
 */
export class GlobalErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error(`[ErrorBoundary:${this.props.boundary ?? "global"}]`, error, info);
    reportLovableError(error, {
      boundary: this.props.boundary ?? "global",
      componentStack: info.componentStack,
    });
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return (
        <ErrorFallback
          error={this.state.error}
          reset={this.reset}
          boundary={this.props.boundary ?? "global"}
        />
      );
    }
    return this.props.children;
  }
}
