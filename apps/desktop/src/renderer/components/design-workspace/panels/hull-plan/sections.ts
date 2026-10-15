/**
 * Public surface of the plan's sections. Presentation metadata (names, copy, spans) lives in `section-meta.ts`
 * and the derived per-section model in `section-facts.ts`; both are re-exported here so callers keep one import.
 */
export {
  SECTION_IDS,
  SECTIONS,
  sectionSpan,
  type SectionId,
  type SectionMeta,
  type ZoneRange,
} from "./section-meta.js";
export {
  fittingKind,
  sectionFacts,
  type FittingKind,
  type SectionFacts,
  type SectionFitting,
} from "./section-facts.js";
