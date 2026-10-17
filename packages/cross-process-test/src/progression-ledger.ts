import type { CompiledContentBundle, Provenance } from "@bluewave/content-schema";
import { compareCodePoints } from "@bluewave/deterministic";

/**
 * N-3 progression ledger (spec #47 R1–R2): a read-only derivation over the
 * compiled content bundle. An availability event is a technology whose global
 * designer `year` has begun, or a part/component introduction month. The
 * ledger lists declared dates; it never restates or reinterprets them.
 */
export type ProgressionEventKind = "component" | "part" | "technology";

export interface ProgressionEvent {
  readonly year: number;
  readonly month: string;
  readonly kind: ProgressionEventKind;
  readonly id: string;
  readonly provenance: {
    readonly sourceStatus: Provenance["sourceStatus"];
    readonly confidence: Provenance["confidence"];
  } | null;
}

export interface ProgressionLedger {
  readonly years: readonly number[];
  readonly events: readonly ProgressionEvent[];
}

export const N3_LEDGER_YEARS = Array.from({ length: 10 }, (_, index) => 1880 + index);

const KIND_ORDER: Readonly<Record<ProgressionEventKind, number>> = {
  component: 0,
  part: 1,
  technology: 2,
};

function yearOf(month: string): number {
  return Number(month.slice(0, 4));
}

function provenanceOf(provenance: Provenance | undefined): ProgressionEvent["provenance"] {
  return provenance === undefined
    ? null
    : { sourceStatus: provenance.sourceStatus, confidence: provenance.confidence };
}

function compareEvents(a: ProgressionEvent, b: ProgressionEvent): number {
  return (
    a.year - b.year ||
    KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
    compareCodePoints(a.id, b.id) ||
    compareCodePoints(a.month, b.month)
  );
}

/** Build the canonical ledger for the requested calendar years (default 1880–1889). */
export function buildProgressionLedger(
  bundle: CompiledContentBundle,
  years: readonly number[] = N3_LEDGER_YEARS,
): ProgressionLedger {
  const inRange = new Set(years);
  const events: ProgressionEvent[] = [];

  for (const technology of bundle.technologies) {
    if (technology.year === undefined || !inRange.has(technology.year)) continue;
    events.push({
      year: technology.year,
      month: `${String(technology.year)}-01`,
      kind: "technology",
      id: technology.id,
      provenance: provenanceOf(technology.provenance),
    });
  }

  for (const component of bundle.shipBuilding?.components ?? []) {
    const month = component.introduction.fromMonth;
    const year = yearOf(month);
    if (!inRange.has(year)) continue;
    events.push({
      year,
      month,
      kind: "component",
      id: component.id,
      provenance: provenanceOf(component.provenance),
    });
  }

  const parts = bundle.shipBuilding?.partModel?.partIndex.byId ?? {};
  for (const id of Object.keys(parts)) {
    const part = parts[id];
    if (part === undefined) continue;
    const month = part.lifecycle.availableFrom;
    const year = yearOf(month);
    if (!inRange.has(year)) continue;
    events.push({
      year,
      month,
      kind: "part",
      id,
      provenance: provenanceOf(part.provenance),
    });
  }

  events.sort(compareEvents);
  return { years: [...years], events };
}

export function progressionEventsForYear(
  ledger: ProgressionLedger,
  year: number,
): readonly ProgressionEvent[] {
  return ledger.events.filter((event) => event.year === year);
}

/** The requested years that carry no availability event, ascending. */
export function idleYears(
  ledger: ProgressionLedger,
  years: readonly number[] = ledger.years,
): readonly number[] {
  const covered = new Set(ledger.events.map((event) => event.year));
  return years.filter((year) => !covered.has(year));
}

export class IdleProgressionYearError extends Error {
  readonly _tag = "IdleProgressionYearError" as const;
  readonly years: readonly number[];

  constructor(years: readonly number[]) {
    super(`No availability event in ${years.map(String).join(", ")}`);
    this.name = "IdleProgressionYearError";
    this.years = years;
  }
}

/** Fail with the idle years named; used by the acceptance test gate. */
export function assertNoIdleYears(
  ledger: ProgressionLedger,
  years: readonly number[] = ledger.years,
): void {
  const idle = idleYears(ledger, years);
  if (idle.length > 0) throw new IdleProgressionYearError(idle);
}
