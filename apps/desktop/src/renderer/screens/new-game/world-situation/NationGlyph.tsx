import { nationFlagUrl } from "../../../content/nation-flag.js";
import { cn } from "../../../lib/utils.js";

export function NationGlyph({
  nationId,
  name,
  className,
}: {
  readonly nationId: string;
  readonly name: string;
  readonly className?: string;
}) {
  const url = nationFlagUrl(nationId);
  const frame = cn("h-6 w-9 shrink-0 rounded-[2px] border border-border shadow-sm", className);
  if (url !== null) {
    return <img src={url} alt="" aria-hidden="true" className={cn(frame, "object-cover")} />;
  }
  return (
    <span
      aria-hidden="true"
      className={cn(
        frame,
        "inline-flex items-center justify-center bg-muted text-xs font-semibold text-muted-foreground",
      )}
    >
      {name.slice(0, 1)}
    </span>
  );
}
