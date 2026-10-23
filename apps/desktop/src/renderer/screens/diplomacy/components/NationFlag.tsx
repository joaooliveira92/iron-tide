import { cn } from "../../../lib/utils.js";
import { nationCode } from "../diplomacy-plot.js";

export interface NationFlagProps {
  readonly url: string | null;
  readonly name: string;
  readonly className?: string;
}

export function NationFlag({ url, name, className }: NationFlagProps) {
  if (url !== null) {
    return (
      <img
        src={url}
        alt=""
        aria-hidden="true"
        draggable={false}
        className={cn("shrink-0 object-cover", className)}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center bg-muted text-xs font-semibold text-muted-foreground",
        className,
      )}
    >
      {nationCode(name)}
    </span>
  );
}
