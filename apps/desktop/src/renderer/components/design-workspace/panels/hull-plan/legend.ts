import type { PresentationFormat } from "../../../../lib/presentation-format/index.js";
import type { DrawingFacts } from "./describe.js";
import type { BowStyle, SternStyle } from "./geometry.js";
import { displaySheerRise, type FunnelInput } from "./profile-geometry.js";
import type { MastSummary } from "./profile-masts.js";
import { STYLE_NAME, eraName } from "./visual-names.js";

/** Where a drawn quantity comes from; shown as a badge so schematic conventions are never mistaken for data. */
export type LegendSource = "data" | "convention" | "mixed";

export interface LegendEntry {
  readonly id: string;
  /** Chip text. */
  readonly label: string;
  /** One line shown in the hover/focus tooltip. */
  readonly tooltip: string;
  /** Popover heading. */
  readonly title: string;
  readonly source: LegendSource;
  readonly rows: readonly (readonly [string, string])[];
  readonly note: string;
}

export interface LegendInput {
  readonly facts: DrawingFacts;
  readonly waterplaneCoeffBp: number | undefined;
  readonly lcbPermille: number | undefined;
  readonly sheerBp: number | undefined;
  readonly funnels: readonly FunnelInput[];
  /** The masts drawn in the profile; absent when none is. */
  readonly masts?: MastSummary;
}

const BOW_NAME: Record<BowStyle, string> = { ram: "Ram", spoon: "Spoon", plumb: "Plumb" };
const BOW_NOTE: Record<BowStyle, string> = {
  ram: "A projecting ram near the waterline with a stem that returns aft: the 1880s cruiser and battleship convention.",
  spoon: "A fine, forward-rising curved stem with no ram: the torpedo-boat convention.",
  plumb: "A blunt, upright stem with a rounded forefoot: the coast-defence convention.",
};
const STERN_NAME: Record<SternStyle, string> = {
  counter: "Counter",
  transom: "Transom",
  round: "Rounded",
};
const STERN_NOTE: Record<SternStyle, string> = {
  counter: "An overhanging, elliptical counter curving under to a raked sternpost.",
  transom: "A flat transom dropping to a rounded heel.",
  round: "A rounded fantail curving under in one sweep.",
};

const formName = (id: string | undefined) => (id ? id.replaceAll("_", " ") : "unknown");

/**
 * The legend chips for the hull-plan drawings. Pure: the panel only renders these; every figure renders through
 * the bound presentation format (ADR-0218).
 */
export function legendEntries(input: LegendInput, format: PresentationFormat): LegendEntry[] {
  const { facts } = input;
  const entries: LegendEntry[] = [];
  const pct = (bp: number) => format.percent(bp, 0);
  const coefficient = (bp: number) =>
    format.number(bp / 10000, { maximumFractionDigits: 2, minimumFractionDigits: 2 });
  const permilleToMetres = (permille: number, lengthM: number) =>
    Number.isFinite(lengthM)
      ? `${format.number((permille / 1000) * lengthM, { maximumFractionDigits: 1, minimumFractionDigits: 1 })} m`
      : "unknown";

  if (input.waterplaneCoeffBp !== undefined && input.lcbPermille !== undefined) {
    entries.push({
      id: "hull-lines",
      label: `Cw ${coefficient(input.waterplaneCoeffBp)} · LCB ${input.lcbPermille}‰`,
      tooltip: "Hull-form values that shape the outline",
      title: "Hull lines",
      source: "data",
      rows: [
        ["Hull form", formName(facts.hullFormId)],
        ["Waterplane coefficient", coefficient(input.waterplaneCoeffBp)],
        [
          "Centre of buoyancy (⊕)",
          `${input.lcbPermille}‰ · ${permilleToMetres(input.lcbPermille, facts.lengthM)} from the bow`,
        ],
      ],
      note: "The drawn waterline area equals the waterplane coefficient and the bow/stern balance follows the LCB. The curves themselves are a drawing convention, not the form's real lines.",
    });
  }

  entries.push(
    {
      id: "bow",
      label: `Bow: ${BOW_NAME[facts.bow].toLowerCase()}`,
      tooltip: `${BOW_NAME[facts.bow]} bow, drawn the same in plan and profile`,
      title: `${BOW_NAME[facts.bow]} bow`,
      source: "convention",
      rows: [["Chosen for", formName(facts.hullFormId)]],
      note: `${BOW_NOTE[facts.bow]} A drawing choice per hull form, not a simulation value.`,
    },
    {
      id: "stern",
      label: `Stern: ${STERN_NAME[facts.stern].toLowerCase()}`,
      tooltip: `${STERN_NAME[facts.stern]} stern, drawn the same in plan and profile`,
      title: `${STERN_NAME[facts.stern]} stern`,
      source: "convention",
      rows: [["Chosen for", formName(facts.hullFormId)]],
      note: `${STERN_NOTE[facts.stern]} A drawing choice per hull form, not a simulation value.`,
    },
  );

  if (input.sheerBp !== undefined) {
    const shown = displaySheerRise(input.sheerBp);
    entries.push({
      id: "sheer",
      label: `Sheer ${pct(input.sheerBp)}`,
      tooltip: "Deck rise toward the ends",
      title: "Sheer",
      source: "mixed",
      rows: [
        ["Hull-form sheer", pct(input.sheerBp)],
        ["Drawn bow rise", `${format.number(shown * 100, { maximumFractionDigits: 0 })}% of depth`],
      ],
      note: "The hull form's sheer drives the rise, bow more than stern. A small display emphasis keeps modest sheer visible; it never turns zero sheer into a rise.",
    });
  }

  const funnelRows = [...input.funnels]
    .sort(
      (a, b) => a.stationPermille - b.stationPermille || a.instanceId.localeCompare(b.instanceId),
    )
    .map((f): readonly [string, string] => [
      f.instanceId,
      `${f.stationPermille}‰ · ${permilleToMetres(f.stationPermille, facts.lengthM)} from the bow`,
    ]);
  entries.push({
    id: "funnels",
    label: `Funnels: ${funnelRows.length}`,
    tooltip: funnelRows.length === 0 ? "No funnel components placed" : "Placed funnel components",
    title: "Funnels",
    source: "mixed",
    rows: funnelRows,
    note:
      funnelRows.length === 0
        ? "No component tagged as a funnel is placed, so none is drawn."
        : "Positions are the placed components' stations. The tapered, raked shape and the height are drawing conventions.",
  });

  const house = facts.superstructure;
  entries.push({
    id: "superstructure",
    label: house
      ? `Superstructure ${Math.round(house.startPermille / 10)}–${Math.round(house.endPermille / 10)}%`
      : "Superstructure: none",
    tooltip: house
      ? "Superstructure zone of the hull form"
      : "This hull form has no superstructure zone",
    title: "Superstructure",
    source: "mixed",
    rows: house
      ? [
          [
            "Zone",
            `${house.startPermille}–${house.endPermille}‰ · ${permilleToMetres(house.startPermille, facts.lengthM)} to ${permilleToMetres(house.endPermille, facts.lengthM)} from the bow`,
          ],
        ]
      : [],
    note: "The hull form's zone sets where it sits. The stepped lower house and bridge are drawing conventions, not component data.",
  });

  if (input.masts) {
    const m = input.masts;
    entries.push({
      id: "masts",
      label: `Masts: ${m.count}`,
      tooltip: "Masts drawn from the superstructure",
      title: "Masts",
      source: "convention",
      rows: [
        ["Style", `${m.style} (${STYLE_NAME[m.style]})`],
        ["Era", eraName(m.era)],
        [
          "Drawing",
          `${m.partId}${m.step === 1 ? "" : m.step === 2 ? " (universal)" : " (dreadnought default)"}`,
        ],
      ],
      note: "A foremast stands at the bridge and a mainmast at the aft end of the superstructure, in the designing nation's style for the design year. Masts are not design components; their position and height are drawing conventions.",
    });
  }

  return entries;
}
