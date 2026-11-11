import { readdirSync } from "node:fs";
import { join } from "node:path";
import { FlattenedPartSchema, decodeStrict, type FlattenedPart } from "@bluewave/content-schema";
import { readAuthoredFile } from "@bluewave/test-support";
import type { DraftCompileContent } from "../../src/compileDraft.js";
import { armamentContent, components, navalProfiles, plants, shipBalance } from "./earlyContext.js";
import { compatibility } from "./gunReadPath.js";
import { torpedoDiameterUm } from "./torpedoModels.js";

const partsDir = join(
  import.meta.dirname,
  "..",
  "..",
  "..",
  "..",
  "content",
  "production",
  "1880",
  "ship-building",
  "parts",
);

export const productionParts: readonly FlattenedPart[] = readdirSync(partsDir)
  .filter((name) => name.endsWith(".ts"))
  .flatMap((name) => {
    const file = readAuthoredFile(join(partsDir, name)) as { parts: unknown[] };
    return file.parts.map((record) => decodeStrict(FlattenedPartSchema, record));
  });

export const draftCompileContent: DraftCompileContent = {
  components,
  plants,
  navalProfiles,
  armament: armamentContent,
  armour: shipBalance.armour,
  compatibility,
  torpedoDiameterUm,
  parts: productionParts,
};
