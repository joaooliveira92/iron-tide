import { Plus, Sparkles } from "lucide-react";
import { memo } from "react";
import type { CardPalette } from "@/components/card-deck/index.js";
import { getArchetypeArtwork } from "@/content/archetypeArtworkManifest.js";
import { archetypeOptionId } from "./ArchetypeCard.js";

export const CUSTOM_ARCHETYPE_ID = "custom";

export const customArchetypeOptionId = (listboxId: string): string =>
  archetypeOptionId(listboxId, CUSTOM_ARCHETYPE_ID);

export interface ArchetypeCustomDeckCardProps {
  readonly palette: CardPalette;
  readonly applied: boolean;
  readonly allocation: {
    readonly economy: number;
    readonly industry: number;
    readonly combat: number;
  } | null;
  readonly listboxId: string;
}

export const ArchetypeCustomDeckCard = memo(function ArchetypeCustomDeckCard({
  palette,
  applied,
  allocation,
  listboxId,
}: ArchetypeCustomDeckCardProps) {
  const allocationLabel =
    allocation === null
      ? "Build a custom split"
      : `${allocation.economy} · ${allocation.industry} · ${allocation.combat}`;

  return (
    <div
      id={customArchetypeOptionId(listboxId)}
      role="option"
      tabIndex={-1}
      aria-label="Create Your Own"
      aria-selected={applied}
      style={{
        background: palette.background,
        borderColor: applied ? "var(--color-admiralty-accent)" : palette.border,
      }}
      className="absolute inset-0 h-full w-full select-none overflow-hidden rounded-[1.15rem] border"
    >
      <img
        src={getArchetypeArtwork("merchant_prince")}
        alt=""
        draggable={false}
        className="absolute inset-0 h-full w-full object-cover opacity-40"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-background/55 backdrop-blur-[1px]"
      />

      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 z-10 h-1.5"
        style={{
          backgroundColor: palette.accent,
          boxShadow: applied ? `0 0 18px ${palette.accent}` : undefined,
        }}
      />

      <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 px-5 text-center text-admiralty-ink">
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-full border ${
            applied ? "border-admiralty-accent bg-admiralty-accent/20" : "border-admiralty-ink/25"
          }`}
        >
          <Plus className="h-5 w-5" aria-hidden="true" />
        </span>
        <p className="text-base font-black uppercase tracking-wide sm:text-lg">Create Your Own</p>
        <p className="line-clamp-2 text-xs leading-snug text-admiralty-ink/70">
          {applied ? (
            <span className="flex items-center gap-1.5 text-admiralty-accent">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              {allocationLabel}
            </span>
          ) : (
            allocationLabel
          )}
        </p>
      </div>
    </div>
  );
});
