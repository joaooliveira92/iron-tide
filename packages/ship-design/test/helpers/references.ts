import type { DesignDraft } from "../../src/index.js";
import { readReferenceDesignEntries } from "./earlyContext.js";

const designs = readReferenceDesignEntries() as {
  id: string;
  name: string;
  month: string;
  draft: DesignDraft;
}[];
const by = (id: string) => designs.find((d) => d.id === id)!.draft;

/** Reference designs live under content/production/1880/ship-building/reference-designs/<nation>/ (shared with the UI). */
export const havock = by("havock_like");
export const majestic = by("majestic_like");
