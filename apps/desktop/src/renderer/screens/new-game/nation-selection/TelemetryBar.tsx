import { Compass } from "lucide-react";

export function TelemetryBar({ coordinateLabel }: { coordinateLabel: string }): React.JSX.Element {
  return (
    <section
      className="h-8 flex-none border-b border-admiralty-border bg-admiralty-surface px-6 flex items-center justify-between font-display text-xs uppercase tracking-widest text-admiralty-ink-faint"
      aria-label="Tactical Status Bar"
    >
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2 text-admiralty-accent/80">
          <Compass className="h-3.5 w-3.5 animate-spin" style={{ animationDuration: "12s" }} />
          <span>Telemetry Lock:</span>
        </div>
        <span className="font-mono text-admiralty-ink tabular-nums tracking-normal">
          {coordinateLabel}
        </span>
      </div>
      <div className="hidden md:flex items-center gap-6 text-admiralty-ink-faint">
        <span>
          NAVIGATE:{" "}
          <kbd className="text-admiralty-accent bg-admiralty-surface-raised px-1.5 py-0.5 rounded border border-admiralty-border">
            ↑↓←→
          </kbd>
        </span>
        <span>
          CONFIRM:{" "}
          <kbd className="text-admiralty-accent bg-admiralty-surface-raised px-1.5 py-0.5 rounded border border-admiralty-border">
            ENTER
          </kbd>
        </span>
        <span>
          ABORT:{" "}
          <kbd className="text-admiralty-accent bg-admiralty-surface-raised px-1.5 py-0.5 rounded border border-admiralty-border">
            ESC
          </kbd>
        </span>
      </div>
    </section>
  );
}
