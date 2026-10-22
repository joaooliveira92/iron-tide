import { cn } from "../../../lib/utils.js";
import type { ReadoutTone } from "../engineering-status.js";

const TONE = {
  neutral: "text-foreground",
  warn: "text-amber-600 dark:text-amber-400",
  bad: "text-destructive",
} as const;

export function ReadoutValue({
  label,
  value,
  tone,
}: {
  readonly label: string;
  readonly value: string;
  readonly tone: ReadoutTone;
}) {
  return (
    <>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn("font-medium tabular-nums", TONE[tone])}>{value}</span>
    </>
  );
}
