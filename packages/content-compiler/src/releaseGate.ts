import { SOURCE_STATUSES } from "@bluewave/content-schema";

import { collectProvenanceLocations } from "./confidence.js";
import type { ContentBundle } from "./index.js";

export const PLACEHOLDER_SOURCE_STATUS: (typeof SOURCE_STATUSES)[number] = "PLACEHOLDER";

export interface PlaceholderViolation {
  readonly collection: string;
  readonly recordId: string;
  readonly field: string;
}

export interface PlaceholderAllowlistEntry {
  readonly collection: string;
  readonly recordId: string;
  readonly field: string;
  readonly justification: string;
}

export interface PlaceholderGateResult {
  readonly ok: boolean;
  readonly violations: readonly PlaceholderViolation[];
  readonly allowed: readonly PlaceholderViolation[];
  readonly invalidAllowlist: readonly string[];
}

export function checkPlaceholderGate(
  bundle: ContentBundle,
  allowlist: readonly PlaceholderAllowlistEntry[],
): PlaceholderGateResult {
  const found = collectPlaceholders(bundle);

  const invalidAllowlist: string[] = [];
  const allowedKeys = new Set<string>();
  for (const entry of allowlist) {
    if (
      typeof entry.collection !== "string" ||
      typeof entry.recordId !== "string" ||
      typeof entry.field !== "string" ||
      typeof entry.justification !== "string" ||
      entry.justification.trim() === ""
    ) {
      invalidAllowlist.push(
        `Allowlist entry for ${entry.collection ?? "?"}/${entry.recordId ?? "?"}/${entry.field ?? "?"} has no justification`,
      );
      continue;
    }
    allowedKeys.add(key(entry.collection, entry.recordId, entry.field));
  }

  const violations: PlaceholderViolation[] = [];
  const allowed: PlaceholderViolation[] = [];
  for (const placeholder of found) {
    if (allowedKeys.has(key(placeholder.collection, placeholder.recordId, placeholder.field))) {
      allowed.push(placeholder);
    } else {
      violations.push(placeholder);
    }
  }

  return {
    ok: violations.length === 0 && invalidAllowlist.length === 0,
    violations,
    allowed,
    invalidAllowlist,
  };
}

export function collectPlaceholders(bundle: ContentBundle): PlaceholderViolation[] {
  return collectProvenanceLocations(bundle)
    .filter((location) => location.sourceStatus === PLACEHOLDER_SOURCE_STATUS)
    .map((location) => ({
      collection: location.collection,
      recordId: location.recordId,
      field: location.field,
    }));
}

function key(collection: string, recordId: string, field: string): string {
  return `${collection}\u0000${recordId}\u0000${field}`;
}
