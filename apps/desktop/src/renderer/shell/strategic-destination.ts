/**
 * Renderer-level deep-link destinations (spec §5 "Deep-link destinations";
 * diagnosis doc §5.3). Navigation instructions only — never persisted, never
 * authoritative; consumers map them onto the shell's `selectScreen`.
 *
 * INC-14 corrections applied against the shipped registry:
 *
 * - `"foreign-relations"` renamed to `"diplomacy"` — the real shipped screen
 *   is labeled "Diplomacy & War" (id `diplomacy`); the doc conforms to it.
 * - No `treasury` member: no treasury route exists (only the stub nav slot);
 *   cash priorities point at `overview`, where the treasury panel lives.
 * - Every `focus*` field stays unvalidated for now — their real targets are
 *   produced by later tickets (standing follow-up: re-check once those
 *   tickets land, trimming any field with no real navigable target).
 */
export const STRATEGIC_DESTINATION_SECTIONS = [
  "overview",
  "construction",
  "fleet",
  "research",
  "diplomacy",
] as const;

export type StrategicDestinationSection = (typeof STRATEGIC_DESTINATION_SECTIONS)[number];

export type StrategicDestination =
  | { readonly section: "overview" }
  | { readonly section: "research"; readonly focusTechnologyId?: string }
  | { readonly section: "construction"; readonly focusProjectId?: string }
  | { readonly section: "fleet"; readonly focusShipId?: string }
  | { readonly section: "diplomacy"; readonly focusNationId?: string };
