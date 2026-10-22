import {
  decodeDesignFile,
  encodeDesignFile,
  PersistenceError,
  type CompiledDesign,
  type DesignDraft,
} from "@bluewave/ship-design";
import type { ComponentDef } from "@bluewave/ship-design";

export type ImportResult =
  | { readonly ok: true; readonly draft: DesignDraft; readonly notes: readonly string[] }
  | { readonly ok: false; readonly error: string };

export function exportDesign(
  draft: DesignDraft,
  catalogue: readonly ComponentDef[],
  compiled: CompiledDesign,
): string {
  return encodeDesignFile(draft, catalogue, compiled);
}

export function importDesign(text: string, catalogue: readonly ComponentDef[]): ImportResult {
  try {
    const d = decodeDesignFile(text, catalogue);
    const notes: string[] = [];
    if (d.migratedFrom !== null) notes.push(`Migrated from file version ${d.migratedFrom}.`);
    if (d.contentDrift.length > 0)
      notes.push(
        `Component definitions changed since this file was saved (${d.contentDrift.join(", ")}); the design was recompiled.`,
      );
    return { ok: true, draft: d.draft, notes };
  } catch (e) {
    return {
      ok: false,
      error: PersistenceError.is(e)
        ? `Cannot open design: ${e.message}`
        : "Cannot open design file.",
    };
  }
}

export const designFileName = (className: string): string =>
  `${
    className
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "design"
  }.bwdesign`;
