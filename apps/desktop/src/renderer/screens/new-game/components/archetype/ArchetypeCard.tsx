import type { ArchetypePreset } from "@bluewave/campaign-engine";
import { Check } from "lucide-react";
import { memo } from "react";
import type { CardPalette } from "@/components/card-deck/index.js";
import { getArchetypeArtwork, isArchetypeArtworkId } from "@/content/archetypeArtworkManifest.js";

export interface ArchetypeCardProps {
  readonly preset: ArchetypePreset;
  readonly palette: CardPalette;
  /** Whether this preset's allocation is the one currently applied to the draft. */
  readonly applied: boolean;
  readonly listboxId: string;
}

/** DOM id of a preset's option element; the listbox points `aria-activedescendant` at it. */
export function archetypeOptionId(listboxId: string, presetId: string): string {
  return `${listboxId}-option-${presetId}`;
}

/**
 * One archetype preset card's *content*. The deck owns position, depth and drag
 * physics; this only paints a single card, so it fills whatever box the deck
 * gives it. `aria-selected` marks the applied preset (what a commit changes),
 * while the listbox's `aria-activedescendant` marks the focused one (what is
 * previewed).
 */
export const ArchetypeCard = memo(function ArchetypeCard({
  preset,
  palette,
  applied,
  listboxId,
}: ArchetypeCardProps) {
  const allocation = `${preset.allocation.economy} · ${preset.allocation.industry} · ${preset.allocation.combat}`;

  return (
    <div
      id={archetypeOptionId(listboxId, preset.id)}
      role="option"
      tabIndex={-1}
      aria-label={preset.name}
      aria-selected={applied}
      style={{
        // Cover gradient is decorative data: only visible behind missing artwork.
        background: palette.background,
        borderColor: applied ? "var(--color-admiralty-accent)" : palette.border,
      }}
      className="absolute inset-0 h-full w-full select-none overflow-hidden rounded-[1.15rem] border"
    >
      {isArchetypeArtworkId(preset.id) && (
        <img
          src={getArchetypeArtwork(preset.id)}
          alt=""
          draggable={false}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-admiralty-surface/75 via-admiralty-surface/5 to-admiralty-surface/90"
      />

      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 z-10 h-1.5"
        style={{
          backgroundColor: palette.accent,
          boxShadow: applied ? `0 0 18px ${palette.accent}` : undefined,
        }}
      />

      <div
        className={`absolute inset-x-0 bottom-0 z-20 min-h-[4.8rem] border-t border-admiralty-ink/20 px-5 py-3 text-admiralty-ink ${
          applied ? "bg-admiralty-surface/35 backdrop-blur-md" : "bg-admiralty-surface/55"
        }`}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="truncate text-base font-black uppercase tracking-wide sm:text-lg">
              {preset.name}
            </p>
            <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-admiralty-ink/70">
              {preset.tagline}
            </p>
            <p className="mt-1 text-[0.65rem] tabular-nums tracking-wide text-admiralty-ink/55">
              {allocation}
            </p>
          </div>

          {applied ? (
            <span className="flex shrink-0 items-center gap-1.5 rounded bg-admiralty-accent px-2.5 py-1 font-display text-[0.7rem] font-black uppercase tracking-wider text-admiralty-accent-foreground">
              <Check className="h-3 w-3" aria-hidden="true" />
              Active
            </span>
          ) : (
            <span className="shrink-0 font-display text-[0.58rem] uppercase tracking-wider text-admiralty-ink/65">
              Select
            </span>
          )}
        </div>
      </div>
    </div>
  );
});
