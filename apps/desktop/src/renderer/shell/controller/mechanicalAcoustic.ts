/**
 * Placeholder for the mechanical-acoustic feedback controller.
 *
 * The exported launch surface calls `playMechanicalAcoustic(kind)` on
 * navigation and confirmation. No audio assets are bundled yet, so this is a
 * no-op that preserves the call sites until a real audio pipeline lands
 * (visual/audio feedback is presentation-only and never touches campaign state).
 */
export type AcousticKind = "click" | "sonar" | "abort";

export function playMechanicalAcoustic(_kind: AcousticKind): void {
  // no-op until audio assets exist
}
