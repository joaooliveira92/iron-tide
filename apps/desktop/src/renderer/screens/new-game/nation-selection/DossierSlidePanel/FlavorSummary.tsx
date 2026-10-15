import type { JSX } from "react";
import { cn } from "@/lib/utils.js";
import { ACCENT_STYLES } from "./DossierAccordion/constants.js";
import type { FlavorSummaryProps } from "./types.js";

export function FlavorSummary({
  icon: Icon,
  label,
  text,
  accentColor,
}: FlavorSummaryProps): JSX.Element {
  const accent = ACCENT_STYLES[accentColor];

  return (
    <article className="group relative min-w-0 bg-admiralty-surface-raised/55 px-4 py-3 backdrop-blur-sm transition-colors hover:bg-admiralty-surface-raised/80 sm:px-5 sm:py-4">
      <div className="mb-2 flex items-center gap-2">
        <span
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-md border",
            accent.text,
            accent.border,
            accent.bg,
          )}
        >
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
        <span
          className={cn(
            "font-display text-[0.65rem] font-black uppercase tracking-[0.18em]",
            accent.text,
          )}
        >
          {label}
        </span>
      </div>
      <p className="line-clamp-3 text-[0.7rem] leading-relaxed text-admiralty-ink-muted sm:text-xs">
        {text}
      </p>
    </article>
  );
}
