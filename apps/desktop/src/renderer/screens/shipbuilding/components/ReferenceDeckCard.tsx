import { memo } from "react";
import type { WorkshopEnvironment } from "@bluewave/ship-design";
import type { CardPalette } from "@/components/card-deck/index.js";
import type { DrawingBoardContent } from "../../../components/design-workspace/content.js";
import { StarterProfile } from "../../../components/design-workspace/index.js";
import type { ReferenceDeckEntry } from "../reference-deck.js";

export function referenceOptionId(listboxId: string, typeId: string): string {
  return `${listboxId}-option-${typeId}`;
}

export const ReferenceDeckCard = memo(function ReferenceDeckCard({
  entry,
  palette,
  listboxId,
  env,
  content,
  month,
}: {
  readonly entry: ReferenceDeckEntry;
  readonly palette: CardPalette;
  readonly listboxId: string;
  readonly env: WorkshopEnvironment;
  readonly content: DrawingBoardContent;
  readonly month: string;
}) {
  const d = entry.definition;
  return (
    <div
      id={referenceOptionId(listboxId, d.id)}
      role="option"
      tabIndex={-1}
      aria-label={`${d.name} (${d.id})`}
      aria-selected={entry.current}
      style={{
        background: palette.background,
        borderColor: entry.current ? "var(--color-admiralty-accent)" : palette.border,
      }}
      className="absolute inset-0 flex h-full w-full select-none flex-col overflow-hidden rounded-[1.15rem] border"
    >
      <div
        aria-hidden="true"
        className="h-1.5 flex-none"
        style={{ backgroundColor: palette.accent }}
      />
      <div className="flex flex-1 items-center justify-center px-4">
        {entry.draft === null ? (
          <p className="font-display text-xs uppercase tracking-wider text-admiralty-ink/70">
            No starter design yet
          </p>
        ) : (
          <div className="w-full rounded-lg bg-admiralty-surface/90 p-2 shadow-inner">
            <StarterProfile draft={entry.draft} env={env} content={content} month={month} />
          </div>
        )}
      </div>
      <div className="min-h-[4.8rem] flex-none border-t border-admiralty-ink/20 bg-admiralty-surface/55 px-5 py-3 text-admiralty-ink">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="line-clamp-2 text-base font-black uppercase leading-tight tracking-wide">
              {d.name} <span className="font-medium text-admiralty-ink/70">{d.id}</span>
            </p>
            <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-admiralty-ink/70">
              {d.recommendedUse}
            </p>
          </div>
          <span className="shrink-0 font-display text-[0.58rem] uppercase tracking-wider text-admiralty-ink/65">
            {entry.current ? "Current" : entry.startable ? "Select" : "Unavailable"}
          </span>
        </div>
      </div>
    </div>
  );
});
