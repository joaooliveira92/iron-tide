import type { JSX, ReactNode } from "react";
import type { PlayableSlotCountryId } from "@/content/nationAssetManifest.js";
import { nationDossier, type PresentationFlavorDto } from "@/content/presentationContent.js";

interface DossierFieldRowProps {
  label: string;
  value: ReactNode;
}

/** Fixed label column, so every row's value starts at the same x across a section. */
function DossierFieldRow({ label, value }: DossierFieldRowProps): JSX.Element {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] items-baseline gap-x-3 border-t border-admiralty-border/40 py-2 first:border-t-0 first:pt-0 last:pb-0">
      <dt className="font-display text-[0.6rem] font-black uppercase leading-snug tracking-[0.12em] text-admiralty-accent">
        {label}
      </dt>
      <dd className="text-[0.76rem] leading-relaxed text-admiralty-ink-muted">{value}</dd>
    </div>
  );
}

/** Five pips plus the figure itself; the pips are decoration, the text carries the value. */
function DifficultyValue({ difficulty }: { difficulty: number }): JSX.Element {
  return (
    <span className="inline-flex items-center gap-2">
      <span aria-hidden="true" className="inline-flex gap-1">
        {[1, 2, 3, 4, 5].map((pip) => (
          <span
            key={pip}
            className={
              pip <= difficulty
                ? "h-1.5 w-3.5 rounded-full bg-admiralty-accent"
                : "h-1.5 w-3.5 rounded-full bg-admiralty-border"
            }
          />
        ))}
      </span>
      <span>{`${difficulty} / 5`}</span>
    </span>
  );
}

export interface DossierTabs {
  readonly economy: ReactNode;
  readonly military: ReactNode;
  readonly diplomacy: ReactNode;
}

/**
 * Composes the nation's authored flavor paragraphs and dossier fields (both
 * compiled into the presentation corpus and served over the content IPC) into
 * the existing three-section accordion (spec §1) — no 4th section.
 */
export function buildDossierTabs(
  countryId: PlayableSlotCountryId,
  flavor: PresentationFlavorDto,
): DossierTabs {
  const fields = nationDossier(countryId);

  return {
    economy: (
      <div>
        <p className="font-display text-[0.85rem] leading-relaxed text-admiralty-ink">
          {flavor.economy}
        </p>
        <dl className="mt-3.5 border-t border-admiralty-border/60 pt-3">
          <DossierFieldRow label="Budget category" value={fields.budgetCategory} />
          <DossierFieldRow label="Shipbuilding capacity" value={fields.shipbuildingCapacity} />
          <DossierFieldRow label="Research strengths" value={fields.researchStrengths} />
          <DossierFieldRow label="Research weaknesses" value={fields.researchWeaknesses} />
        </dl>
      </div>
    ),
    military: (
      <div>
        <p className="font-display text-[0.85rem] leading-relaxed text-admiralty-ink">
          {flavor.military}
        </p>
        <dl className="mt-3.5 border-t border-admiralty-border/60 pt-3">
          <DossierFieldRow label="Doctrine" value={fields.doctrine} />
          <DossierFieldRow
            label="Difficulty"
            value={<DifficultyValue difficulty={fields.difficulty} />}
          />
          <DossierFieldRow label="Likely rivals" value={fields.likelyRivals.join(", ")} />
        </dl>
      </div>
    ),
    diplomacy: (
      <div>
        <p className="font-display text-[0.85rem] leading-relaxed text-admiralty-ink">
          {flavor.diplomacy}
        </p>
        <dl className="mt-3.5 border-t border-admiralty-border/60 pt-3">
          <DossierFieldRow label="Strategic regions" value={fields.strategicRegions} />
          <DossierFieldRow
            label="National characteristics"
            value={fields.nationalCharacteristics}
          />
        </dl>
      </div>
    ),
  };
}
