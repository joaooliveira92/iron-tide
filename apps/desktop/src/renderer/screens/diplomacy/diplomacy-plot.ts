export const PLOT_SIZE = 640;
export const PLOT_MARGIN_X = 110;
export const PLOT_MARGIN_Y = 20;
export const PLOT_WIDTH = PLOT_SIZE + PLOT_MARGIN_X * 2;
export const PLOT_HEIGHT = PLOT_SIZE + PLOT_MARGIN_Y * 2;
export const PLOT_CENTER = PLOT_SIZE / 2;
export const PLOT_OUTER_RADIUS = 262;
export const PLOT_INNER_RADIUS = 64;
export const PLOT_MAX_TENSION = 10;

export interface PlotRing {
  readonly id: string;
  readonly label: string;
  readonly tension: number;
}

export const PLOT_RINGS: readonly PlotRing[] = [
  { id: "neutral", label: "Neutral", tension: 3 },
  { id: "strained", label: "Strained", tension: 6 },
  { id: "hostile", label: "Hostile", tension: 8 },
  { id: "war_imminent", label: "War imminent", tension: 10 },
];

export interface PlotInput {
  readonly partnerNationId: string;
  readonly partnerName: string;
  readonly tension: number;
}

export interface PlotNode {
  readonly id: string;
  readonly name: string;
  readonly code: string;
  readonly x: number;
  readonly y: number;
  readonly angle: number;
  readonly radius: number;
}

const round1 = (value: number) => Math.round(value * 10) / 10;

export function tensionRadius(tension: number): number {
  const clamped = Math.min(PLOT_MAX_TENSION, Math.max(0, tension));
  return round1(
    PLOT_OUTER_RADIUS - ((PLOT_OUTER_RADIUS - PLOT_INNER_RADIUS) * clamped) / PLOT_MAX_TENSION,
  );
}

export function pointAt(angleDegrees: number, radius: number): { x: number; y: number } {
  const radians = (angleDegrees * Math.PI) / 180;
  return {
    x: round1(PLOT_CENTER + radius * Math.cos(radians)),
    y: round1(PLOT_CENTER + radius * Math.sin(radians)),
  };
}

const GENERIC_WORDS = new Set([
  "of",
  "the",
  "empire",
  "kingdom",
  "republic",
  "dynasty",
  "united",
  "states",
  "federation",
  "confederation",
  "sultanate",
  "grand",
  "duchy",
]);

const NAME_FILLER = new Set([
  "of",
  "the",
  "empire",
  "kingdom",
  "republic",
  "dynasty",
  "federation",
  "confederation",
  "sultanate",
  "grand",
  "duchy",
]);

export function shortNationName(name: string): string {
  const kept = name.split(/\s+/).filter((word) => !NAME_FILLER.has(word.toLowerCase()));
  return kept.length === 0 ? name : kept.join(" ");
}

export function percentAt(x: number, y: number): { left: string; top: string } {
  return {
    left: `${round1(((x + PLOT_MARGIN_X) / PLOT_WIDTH) * 1000) / 10}%`,
    top: `${round1(((y + PLOT_MARGIN_Y) / PLOT_HEIGHT) * 1000) / 10}%`,
  };
}

export function nationCode(name: string): string {
  const words = name.split(/[\s-]+/).filter((word) => word.length > 0);
  const distinctive = words.find((word) => !GENERIC_WORDS.has(word.toLowerCase()));
  if (distinctive !== undefined) return distinctive.slice(0, 3).toUpperCase();
  const initials = words.map((word) => word[0]!).join("");
  return (initials.length > 0 ? initials : name).slice(0, 3).toUpperCase();
}

export function plotLayout(rows: readonly PlotInput[]): PlotNode[] {
  const ordered = [...rows].sort((a, b) => a.partnerName.localeCompare(b.partnerName));
  const count = ordered.length;
  return ordered.map((row, index) => {
    const angle = round1(-90 + (360 * (index + 0.5)) / count);
    const radius = tensionRadius(row.tension);
    return {
      id: row.partnerNationId,
      name: row.partnerName,
      code: nationCode(row.partnerName),
      angle,
      radius,
      ...pointAt(angle, radius),
    };
  });
}
