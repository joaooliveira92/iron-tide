import { Anchor, Check } from "lucide-react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "../../lib/utils.js";
import { Slate } from "./Slate.js";

export interface DispatchSlipProps {
  readonly label: string;
  readonly sealed: boolean;
  readonly testId?: string;
  readonly children: ReactNode;
}

export function DispatchSlip({ label, sealed, testId, children }: DispatchSlipProps) {
  return (
    <Slate
      aria-label={label}
      data-testid={testId}
      className="flex w-full max-w-[44rem] overflow-hidden"
    >
      <span
        aria-hidden="true"
        className={cn(
          "w-1 shrink-0 transition-colors duration-300 motion-reduce:transition-none",
          sealed ? "bg-admiralty-accent" : "bg-admiralty-border",
        )}
      />
      <div className="min-w-0 flex-1 space-y-3 px-4 py-3.5">{children}</div>
    </Slate>
  );
}

export interface SealedLineProps {
  readonly children: ReactNode;
  readonly action?: ReactNode;
}

export function SealedLine({ children, action }: SealedLineProps) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-sm bg-admiralty-accent/10 px-3 py-2 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95 motion-safe:duration-200">
      <p role="status" className="flex items-start gap-2 text-sm font-medium text-admiralty-accent">
        <Anchor aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <span>{children}</span>
      </p>
      {action}
    </div>
  );
}

export interface CourseChipProps {
  readonly label: string;
  readonly onClick: () => void;
  readonly pressed?: boolean;
}

export function CourseChip({ label, onClick, pressed }: CourseChipProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm border px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-admiralty-signal motion-reduce:transition-none",
        pressed === true
          ? "border-admiralty-accent bg-admiralty-accent font-medium text-admiralty-accent-foreground"
          : "border-admiralty-border bg-admiralty-surface text-admiralty-ink hover:border-admiralty-accent hover:bg-admiralty-accent/5",
      )}
    >
      {pressed === true ? <Check aria-hidden="true" className="size-3.5 shrink-0" /> : null}
      {label}
    </button>
  );
}

export interface SlipButtonProps extends ComponentPropsWithoutRef<"button"> {
  readonly tone: "primary" | "quiet";
}

export function SlipButton({ tone, className, type = "button", ...props }: SlipButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-admiralty-signal disabled:pointer-events-none disabled:opacity-45",
        tone === "primary"
          ? "rounded-sm bg-admiralty-ink px-4 py-2 text-sm font-semibold text-admiralty-surface-raised hover:bg-admiralty-ink/90"
          : "rounded-sm text-sm text-admiralty-ink-muted underline underline-offset-2 hover:text-admiralty-ink",
        className,
      )}
      {...props}
    />
  );
}
