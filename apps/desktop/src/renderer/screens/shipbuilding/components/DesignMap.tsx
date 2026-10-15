import { cn } from "../../../lib/utils.js";
import { plural } from "../../../components/design-workspace/index.js";
import { SECTION_ORDER, type DesignSectionId } from "../design-sections.js";
import type { SectionStatus } from "../section-status.js";

export interface DesignMapProps {
  readonly active: DesignSectionId;
  readonly statuses: { readonly [K in DesignSectionId]: SectionStatus };
  readonly onSelect: (section: DesignSectionId) => void;
}

/** The status mark (✓ valid, ! warning, a count of unresolved issues, – not configured) and its spoken meaning. */
function statusMark(status: SectionStatus): {
  readonly mark: string;
  readonly meaning: string;
  readonly tone: string;
} {
  switch (status.kind) {
    case "valid":
      return { mark: "✓", meaning: "valid", tone: "text-muted-foreground" };
    case "warning":
      return { mark: "!", meaning: plural(status.count, "warning"), tone: "text-warning" };
    case "issues":
      return {
        mark: String(status.count),
        meaning: plural(status.count, "unresolved issue"),
        tone: "bg-destructive text-destructive-foreground",
      };
    case "not-configured":
      return { mark: "–", meaning: "not configured", tone: "text-muted-foreground" };
  }
}

/**
 * The left rail: the ship's systems as a map, not a wizard. Experienced players jump straight to any section, and
 * each section shows where the design stands. Below extra-large widths the rail collapses to icons with their marks.
 */
export function DesignMap({ active, statuses, onSelect }: DesignMapProps) {
  return (
    <nav aria-label="Design map" className="flex h-full flex-col gap-1 border-r p-1.5 xl:p-2">
      <ul className="flex flex-col gap-1">
        {SECTION_ORDER.map(({ id, label, icon: Icon }) => {
          const { mark, meaning, tone } = statusMark(statuses[id]);
          return (
            <li key={id}>
              <button
                type="button"
                aria-label={`${label}, ${meaning}`}
                title={`${label}: ${meaning}`}
                aria-current={active === id ? "location" : undefined}
                data-active={active === id}
                data-status={statuses[id].kind}
                onClick={() => onSelect(id)}
                className={cn(
                  "relative flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm outline-none",
                  "max-xl:justify-center max-xl:px-0",
                  "hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring",
                  "data-[active=true]:bg-accent data-[active=true]:font-medium",
                )}
              >
                <Icon aria-hidden="true" className="size-4 shrink-0" />
                <span className="truncate max-xl:sr-only">{label}</span>
                <span
                  aria-hidden="true"
                  className={cn(
                    "ml-auto flex min-w-5 items-center justify-center rounded-full px-1 text-xs font-semibold tabular-nums",
                    "max-xl:absolute max-xl:top-0 max-xl:right-0 max-xl:ml-0 max-xl:min-w-4 max-xl:text-[0.625rem]",
                    tone,
                  )}
                >
                  {mark}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
