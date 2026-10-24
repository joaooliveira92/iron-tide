import { FlaskConical, Undo2 } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "../../../components/ui/badge.js";
import { Button } from "../../../components/ui/button.js";
import { Kbd } from "../../../components/ui/kbd.js";
import { SHORTCUT_MOD } from "../../../components/design-workspace/index.js";
import { cn } from "../../../lib/utils.js";

export interface ResearchCommandBarProps {
  readonly highCount: number;
  readonly highCap: number;
  readonly highCountValid: boolean;
  readonly dirty: boolean;
  readonly busy: boolean;
  readonly canSubmit: boolean;
  readonly onRevert: () => void;
  readonly onSubmit: () => void;
  readonly extras?: ReactNode;
}

export function ResearchCommandBar({
  highCount,
  highCap,
  highCountValid,
  dirty,
  busy,
  canSubmit,
  onRevert,
  onSubmit,
  extras,
}: ResearchCommandBarProps) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b px-4 py-2">
      <div className="flex items-center gap-3">
        <h2 className="flex items-center gap-2 text-lg font-medium tracking-tight">
          <FlaskConical aria-hidden="true" className="size-5 text-primary" />
          Research &amp; Technology
        </h2>
        <div
          role="img"
          aria-label={`${highCount} of ${highCap} High priority slots used`}
          title={`${highCount} of ${highCap} High priority slots used`}
          className="flex items-center gap-1"
        >
          {Array.from({ length: highCap }, (_, slot) => (
            <span
              key={slot}
              aria-hidden="true"
              className={cn(
                "size-2 rounded-full border transition-colors",
                slot < highCount
                  ? highCountValid
                    ? "border-primary bg-primary"
                    : "border-destructive bg-destructive"
                  : "border-border bg-transparent",
              )}
            />
          ))}
          <span className="ml-1 text-xs text-muted-foreground">High slots</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {extras}
        {dirty && (
          <Badge
            variant="outline"
            role="status"
            aria-live="polite"
            className="border-amber-500/60 text-amber-600 dark:text-amber-400"
          >
            Unsaved changes
          </Badge>
        )}
        <Button variant="ghost" size="sm" disabled={!dirty || busy} onClick={onRevert}>
          <Undo2 aria-hidden="true" />
          Revert
        </Button>
        <Button
          size="sm"
          disabled={!canSubmit || busy}
          onClick={onSubmit}
          aria-keyshortcuts="Meta+Enter Control+Enter"
        >
          {busy ? "Applying…" : "Set priorities"}
          {!busy && (
            <Kbd className="h-4 bg-primary-foreground/20 px-1 text-[0.6875rem] text-primary-foreground">
              {SHORTCUT_MOD}↵
            </Kbd>
          )}
        </Button>
      </div>
    </header>
  );
}
