import type { ComponentPropsWithoutRef } from "react";
import { cn } from "../../lib/utils.js";

export function Slate({ className, ...props }: ComponentPropsWithoutRef<"section">) {
  return (
    <section
      className={cn(
        "pointer-events-auto rounded-sm border border-admiralty-border bg-admiralty-surface-raised text-admiralty-ink shadow-[0_8px_28px_-10px_rgb(11_26_43/0.55)]",
        className,
      )}
      {...props}
    />
  );
}

export function SlateTitle({ className, ...props }: ComponentPropsWithoutRef<"h3">) {
  return (
    <h3
      className={cn("font-display text-base font-semibold leading-tight tracking-tight", className)}
      {...props}
    />
  );
}

export function Leader({ className }: { readonly className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "mb-1 min-w-4 flex-1 self-end border-b border-dotted border-admiralty-ink-faint/70",
        className,
      )}
    />
  );
}

export interface LedgerRowProps {
  readonly label: string;
  readonly value: string;
  readonly emphasis?: boolean;
}

export function LedgerRow({ label, value, emphasis = false }: LedgerRowProps) {
  return (
    <div className="flex items-baseline gap-2 py-1 text-sm">
      <dt className="min-w-0 truncate">{label}</dt>
      <Leader />
      <dd
        className={cn(
          "shrink-0 font-display tabular-nums",
          emphasis ? "font-semibold text-admiralty-accent" : "text-admiralty-ink",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
