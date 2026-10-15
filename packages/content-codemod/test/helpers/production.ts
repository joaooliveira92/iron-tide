import { PART_TAGS } from "@bluewave/content-schema";
import { join } from "node:path";
// The authoritative decoded content, shared with the equivalence harness so the codemod is
// tested against exactly the inputs the 11b builders and the equivalence gate read.
import {
  armamentContent,
  components,
  hullRecords,
  navalProfiles,
  readReferenceDesignEntries,
  shipBalance,
  plants,
} from "../../../ship-design/test/helpers/earlyContext.js";
import {
  torpedoDiameterUm,
  torpedoModels,
} from "../../../ship-design/test/helpers/torpedoModels.js";
import type { LegacySource } from "../../src/types.js";

export { armamentContent, components, hullRecords, navalProfiles, shipBalance, plants };

export const contentDir = join(
  import.meta.dirname,
  "..",
  "..",
  "..",
  "..",
  "content",
  "production",
  "1880",
);

export { torpedoDiameterUm, torpedoModels };

/** The in-memory legacy source (the same content the equivalence harness compiles). */
export const legacySource: LegacySource = {
  components,
  plants,
  hullForms: hullRecords,
  armour: shipBalance.armour,
  armament: armamentContent,
  profiles: navalProfiles,
  designs: readReferenceDesignEntries(),
  tagVocabulary: PART_TAGS,
  torpedoDiameterUm,
  torpedoModels,
  sourceFiles: [],
};
