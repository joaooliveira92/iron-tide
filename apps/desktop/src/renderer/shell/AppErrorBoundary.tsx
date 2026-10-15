import { Component, type ErrorInfo, type ReactNode } from "react";

interface AppErrorBoundaryProps {
  readonly children: ReactNode;
}

interface AppErrorBoundaryState {
  readonly incidentId: string | null;
}

function newIncidentId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `ui-${Date.now().toString(36)}`;
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  override state: AppErrorBoundaryState = {
    incidentId: null,
  };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return {
      incidentId: newIncidentId(),
    };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error("Renderer failure", {
      incidentId: this.state.incidentId,
      error,
      componentStack: info.componentStack,
    });
  }

  private readonly reload = (): void => {
    window.location.reload();
  };

  override render(): ReactNode {
    if (this.state.incidentId === null) {
      return this.props.children;
    }

    return (
      <main className="grid min-h-svh place-items-center bg-background p-8 text-foreground">
        <section role="alert" className="w-full max-w-lg rounded-lg border bg-card p-6 shadow-sm">
          <h1 className="text-xl font-semibold">Bluewave encountered an error</h1>

          <p className="mt-2 text-sm text-muted-foreground">
            Your campaign data was not modified. Reload the application and try again.
          </p>

          <p className="mt-3 font-mono text-xs text-muted-foreground">
            Reference: {this.state.incidentId}
          </p>

          <button
            type="button"
            className="mt-5 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
            onClick={this.reload}
          >
            Reload Bluewave
          </button>
        </section>
      </main>
    );
  }
}
