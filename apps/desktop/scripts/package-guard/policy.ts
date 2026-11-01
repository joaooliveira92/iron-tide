import { PackagePolicyError } from "./errors.ts";

export type PackageMode = "default" | "spike" | "adapter";
export type FileLocation = "archive" | "unpacked" | "outside";

export interface ForbiddenRule {
  readonly id: string;
  readonly class: string;
  readonly reason: string;
  readonly patterns: readonly string[];
  readonly locations: readonly FileLocation[] | null;
  readonly includeNodeModules: boolean;
}

export interface AllowRule {
  readonly id: string;
  readonly class: string;
  readonly reason: string;
  readonly pattern: string;
  readonly maxBytes: number;
  readonly required: boolean;
}

export interface SizeBudget {
  readonly archiveBytesMax: number;
  readonly outsideArchiveBytesMax: number;
  readonly unlistedFileBytesMax: number;
}

export interface ModePolicy {
  readonly allow: readonly AllowRule[];
  readonly budget: SizeBudget;
  readonly integrity: {
    readonly manifest: string;
    readonly pack: string;
  } | null;
}

export interface LargeFileAllowance {
  readonly pattern: string;
  readonly maxBytes: number;
  readonly reason: string;
}

export interface PackagePolicy {
  readonly policyVersion: string;
  readonly forbidden: readonly ForbiddenRule[];
  readonly largeFileAllowances: readonly LargeFileAllowance[];
  readonly duplicateWatchExtensions: readonly string[];
  readonly duplicateWatchSegments: readonly string[];
  readonly duplicateExemptSegments: readonly string[];
  readonly textExtensions: readonly string[];
  readonly textScanMaxBytes: number;
  readonly absolutePathPatterns: readonly { readonly id: string; readonly regex: string }[];
  readonly modes: Readonly<Record<PackageMode, ModePolicy>>;
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new PackagePolicyError(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new PackagePolicyError(`${label} must be a non-empty string`);
  }
  return value;
}

function count(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new PackagePolicyError(`${label} must be a non-negative integer`);
  }
  return value;
}

function list(value: unknown, label: string): readonly unknown[] {
  if (!Array.isArray(value)) throw new PackagePolicyError(`${label} must be an array`);
  return value;
}

function strings(value: unknown, label: string): readonly string[] {
  return list(value, label).map((entry, index) => text(entry, `${label}[${index}]`));
}

function budget(value: unknown, label: string): SizeBudget {
  const source = record(value, label);
  return {
    archiveBytesMax: count(source.archiveBytesMax, `${label}.archiveBytesMax`),
    outsideArchiveBytesMax: count(source.outsideArchiveBytesMax, `${label}.outsideArchiveBytesMax`),
    unlistedFileBytesMax: count(source.unlistedFileBytesMax, `${label}.unlistedFileBytesMax`),
  };
}

function mode(value: unknown, label: string): ModePolicy {
  const source = record(value, label);
  const integrity =
    source.integrity === null || source.integrity === undefined
      ? null
      : (() => {
          const raw = record(source.integrity, `${label}.integrity`);
          return {
            manifest: text(raw.manifest, `${label}.integrity.manifest`),
            pack: text(raw.pack, `${label}.integrity.pack`),
          };
        })();
  return {
    allow: list(source.allow, `${label}.allow`).map((entry, index) => {
      const rule = record(entry, `${label}.allow[${index}]`);
      return {
        id: text(rule.id, `${label}.allow[${index}].id`),
        class: text(rule.class, `${label}.allow[${index}].class`),
        reason: text(rule.reason, `${label}.allow[${index}].reason`),
        pattern: text(rule.pattern, `${label}.allow[${index}].pattern`),
        maxBytes: count(rule.maxBytes, `${label}.allow[${index}].maxBytes`),
        required: rule.required === true,
      };
    }),
    budget: budget(source.budget, `${label}.budget`),
    integrity,
  };
}

export function decodePolicy(value: unknown): PackagePolicy {
  const source = record(value, "policy");
  if (source.schemaVersion !== 1) {
    throw new PackagePolicyError("policy: unsupported schemaVersion");
  }
  const modes = record(source.modes, "policy.modes");
  const forbidden = list(source.forbidden, "policy.forbidden").map((entry, index) => {
    const rule = record(entry, `policy.forbidden[${index}]`);
    return {
      id: text(rule.id, `policy.forbidden[${index}].id`),
      class: text(rule.class, `policy.forbidden[${index}].class`),
      reason: text(rule.reason, `policy.forbidden[${index}].reason`),
      patterns: strings(rule.patterns, `policy.forbidden[${index}].patterns`),
      locations:
        rule.locations === undefined
          ? null
          : (strings(rule.locations, `policy.forbidden[${index}].locations`) as FileLocation[]),
      includeNodeModules: rule.includeNodeModules === true,
    };
  });
  const ids = forbidden.map((rule) => rule.id);
  if (new Set(ids).size !== ids.length) throw new PackagePolicyError("policy: duplicate rule ids");
  return {
    policyVersion: text(source.policyVersion, "policy.policyVersion"),
    forbidden,
    largeFileAllowances: list(source.largeFileAllowances, "policy.largeFileAllowances").map(
      (entry, index) => {
        const rule = record(entry, `policy.largeFileAllowances[${index}]`);
        return {
          pattern: text(rule.pattern, `policy.largeFileAllowances[${index}].pattern`),
          maxBytes: count(rule.maxBytes, `policy.largeFileAllowances[${index}].maxBytes`),
          reason: text(rule.reason, `policy.largeFileAllowances[${index}].reason`),
        };
      },
    ),
    duplicateWatchExtensions: strings(
      source.duplicateWatchExtensions,
      "policy.duplicateWatchExtensions",
    ),
    duplicateWatchSegments: strings(source.duplicateWatchSegments, "policy.duplicateWatchSegments"),
    duplicateExemptSegments: strings(
      source.duplicateExemptSegments,
      "policy.duplicateExemptSegments",
    ),
    textExtensions: strings(source.textExtensions, "policy.textExtensions"),
    textScanMaxBytes: count(source.textScanMaxBytes, "policy.textScanMaxBytes"),
    absolutePathPatterns: list(source.absolutePathPatterns, "policy.absolutePathPatterns").map(
      (entry, index) => {
        const rule = record(entry, `policy.absolutePathPatterns[${index}]`);
        return {
          id: text(rule.id, `policy.absolutePathPatterns[${index}].id`),
          regex: text(rule.regex, `policy.absolutePathPatterns[${index}].regex`),
        };
      },
    ),
    modes: {
      default: mode(modes.default, "policy.modes.default"),
      spike: mode(modes.spike, "policy.modes.spike"),
      adapter: mode(modes.adapter, "policy.modes.adapter"),
    },
  };
}

export function globToRegExp(glob: string): RegExp {
  let source = "";
  for (let index = 0; index < glob.length; index++) {
    const char = glob[index] as string;
    if (char === "*") {
      if (glob[index + 1] === "*") {
        const slash = glob[index + 2] === "/";
        source += slash ? "(?:.*/)?" : ".*";
        index += slash ? 2 : 1;
      } else source += "[^/]*";
    } else if (char === "?") source += "[^/]";
    else source += char.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${source}$`);
}

export function matches(glob: string, path: string): boolean {
  return globToRegExp(glob).test(path);
}

export function inNodeModules(path: string): boolean {
  return path.split("/").includes("node_modules");
}
