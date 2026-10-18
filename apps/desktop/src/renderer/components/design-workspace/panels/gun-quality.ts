/** Gun quality runs -3..+2 on the combat scale (neutral 0) and is granted by research, never set by the design. */
export const NEUTRAL_GUN_QUALITY = 0;

const signed = (q: number) => (q > 0 ? `+${q}` : `${q}`);

/**
 * The read-only line for a battery's gun quality. `quality` is what research has granted this calibre; no research
 * source assigns one yet, so callers pass the neutral value and the line says so rather than implying a bonus.
 */
export function gunQualityLine(quality: number): string {
  const note = quality === NEUTRAL_GUN_QUALITY ? "neutral, no research bonus yet" : "from research";
  return `Gun quality ${signed(quality)} (${note}). Set by research, not by the design.`;
}
