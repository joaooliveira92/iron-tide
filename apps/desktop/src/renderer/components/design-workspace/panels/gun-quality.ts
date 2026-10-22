export const NEUTRAL_GUN_QUALITY = 0;

const signed = (q: number) => (q > 0 ? `+${q}` : `${q}`);

export function gunQualityLine(quality: number): string {
  const note = quality === NEUTRAL_GUN_QUALITY ? "neutral, no research bonus yet" : "from research";
  return `Gun quality ${signed(quality)} (${note}). Set by research, not by the design.`;
}
