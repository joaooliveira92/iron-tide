import {
  globToRegExp,
  inNodeModules,
  type AllowRule,
  type FileLocation,
  type PackageMode,
  type PackagePolicy,
} from "./policy.ts";
import {
  compareFiles,
  isRuntimeResource,
  sha256,
  type PackageFile,
  type PackageSnapshot,
} from "./snapshot.ts";

export interface Violation {
  readonly location: FileLocation | "package";
  readonly path: string;
  readonly rule: string;
  readonly class: string;
  readonly reason: string;
}

export interface GuardReport {
  readonly mode: PackageMode;
  readonly policyVersion: string;
  readonly passed: boolean;
  readonly counts: {
    readonly files: number;
    readonly allowed: number;
    readonly violations: number;
  };
  readonly sizes: {
    readonly archiveBytes: number;
    readonly archiveBytesMax: number;
    readonly outsideResourceBytes: number;
    readonly outsideResourceBytesMax: number;
  };
  readonly allowed: readonly {
    readonly rule: string;
    readonly path: string;
    readonly size: number;
  }[];
  readonly violations: readonly Violation[];
}

function extension(path: string): string {
  const base = path.slice(path.lastIndexOf("/") + 1);
  const dot = base.lastIndexOf(".");
  return dot <= 0 ? "" : base.slice(dot).toLowerCase();
}

function compareViolations(a: Violation, b: Violation): number {
  const order: Record<string, number> = { archive: 0, unpacked: 1, outside: 2, package: 3 };
  const byLocation = (order[a.location] ?? 9) - (order[b.location] ?? 9);
  if (byLocation !== 0) return byLocation;
  if (a.path !== b.path) return a.path < b.path ? -1 : 1;
  return a.rule < b.rule ? -1 : a.rule > b.rule ? 1 : 0;
}

function megabytes(bytes: number): string {
  return `${(bytes / 1_000_000).toFixed(2)} MB`;
}

function integrityViolations(
  files: readonly PackageFile[],
  manifestPath: string,
  packPath: string,
): Violation[] {
  const manifest = files.find((file) => file.location === "archive" && file.path === manifestPath);
  const pack = files.find((file) => file.location === "archive" && file.path === packPath);
  if (manifest === undefined || pack === undefined) return [];
  const make = (path: string, reason: string): Violation => ({
    location: "archive",
    path,
    rule: "spike-pack-integrity",
    class: "generated-spike-runtime",
    reason,
  });
  let parsed: { integrity?: { packSha256?: unknown }; sizes?: { packBytes?: unknown } };
  try {
    parsed = JSON.parse(manifest.read().toString("utf8"));
  } catch {
    return [make(manifestPath, "the tile manifest is not valid JSON")];
  }
  const recorded = parsed.integrity?.packSha256;
  if (typeof recorded !== "string") {
    return [make(manifestPath, "the tile manifest records no integrity.packSha256")];
  }
  const out: Violation[] = [];
  if (sha256(pack.read()) !== recorded) {
    out.push(make(packPath, "the packaged tile pack does not match the SHA-256 in its manifest"));
  }
  const bytes = parsed.sizes?.packBytes;
  if (typeof bytes === "number" && bytes !== pack.size) {
    out.push(
      make(packPath, `the packaged tile pack is ${pack.size} bytes; the manifest says ${bytes}`),
    );
  }
  return out;
}

export function evaluatePackage(
  snapshot: PackageSnapshot,
  policy: PackagePolicy,
  mode: PackageMode,
): GuardReport {
  const modePolicy = policy.modes[mode];
  const allowRules = modePolicy.allow.map((rule) => ({ rule, regex: globToRegExp(rule.pattern) }));
  const forbidden = policy.forbidden.map((rule) => ({
    rule,
    regexes: rule.patterns.map(globToRegExp),
  }));
  const allowances = policy.largeFileAllowances.map((entry) => ({
    entry,
    regex: globToRegExp(entry.pattern),
  }));
  const textExtensions = new Set(policy.textExtensions);
  const watchExtensions = new Set(policy.duplicateWatchExtensions);
  const absolutePatterns = policy.absolutePathPatterns.map((entry) => ({
    id: entry.id,
    regex: new RegExp(entry.regex),
  }));
  const violations: Violation[] = [];
  const allowed: { rule: string; path: string; size: number }[] = [];
  const matchedAllow = new Set<string>();
  const watched = new Map<string, PackageFile[]>();
  const files = [...snapshot.files].sort(compareFiles);

  for (const file of files) {
    const nodeModules = inNodeModules(file.path);
    const allowRule: AllowRule | undefined =
      file.location === "archive"
        ? allowRules.find((entry) => entry.regex.test(file.path))?.rule
        : undefined;
    if (allowRule !== undefined) {
      matchedAllow.add(allowRule.id);
      allowed.push({ rule: allowRule.id, path: file.path, size: file.size });
      if (file.size > allowRule.maxBytes) {
        violations.push({
          location: file.location,
          path: file.path,
          rule: `${allowRule.id}:size`,
          class: allowRule.class,
          reason: `allowed asset is ${file.size} bytes, above its ${allowRule.maxBytes} byte cap`,
        });
      }
    } else {
      let flagged = false;
      for (const { rule, regexes } of forbidden) {
        if (nodeModules && !rule.includeNodeModules) continue;
        if (rule.locations !== null && !rule.locations.includes(file.location)) continue;
        if (!regexes.some((regex) => regex.test(file.path))) continue;
        flagged = true;
        violations.push({
          location: file.location,
          path: file.path,
          rule: rule.id,
          class: rule.class,
          reason: rule.reason,
        });
      }
      const sized = !nodeModules && (file.location === "archive" || isRuntimeResource(file.path));
      if (!flagged && sized) {
        const allowance = allowances.find((entry) => entry.regex.test(file.path));
        const cap = allowance?.entry.maxBytes ?? modePolicy.budget.unlistedFileBytesMax;
        if (file.size > cap) {
          violations.push({
            location: file.location,
            path: file.path,
            rule: "unexpected-large-file",
            class: "unexpected-binary",
            reason: `${megabytes(file.size)} exceeds the ${megabytes(cap)} cap for files with no explicit allowance`,
          });
        }
      }
    }
    if (nodeModules) continue;
    if (textExtensions.has(extension(file.path)) && file.size <= policy.textScanMaxBytes) {
      const content = file.read().toString("utf8");
      for (const { id, regex } of absolutePatterns) {
        const hit = regex.exec(content);
        if (hit !== null) {
          violations.push({
            location: file.location,
            path: file.path,
            rule: `machine-path:${id}`,
            class: "machine-specific",
            reason: `serialises a machine-specific absolute path (${hit[0].slice(0, 40)})`,
          });
        }
      }
    }
    const segments = file.path.split("/");
    if (
      !policy.duplicateExemptSegments.some((segment) => segments.includes(segment)) &&
      (watchExtensions.has(extension(file.path)) ||
        policy.duplicateWatchSegments.some((segment) => segments.includes(segment)))
    ) {
      const key = `${file.size}:${sha256(file.read())}`;
      watched.set(key, [...(watched.get(key) ?? []), file]);
    }
  }

  for (const group of watched.values()) {
    const [first, ...rest] = group;
    if (first === undefined) continue;
    for (const copy of rest) {
      violations.push({
        location: copy.location,
        path: copy.path,
        rule: "duplicate-copy",
        class: "duplicate-map-asset",
        reason: `byte-identical duplicate of ${first.path}`,
      });
    }
  }

  for (const { rule } of allowRules) {
    if (rule.required && !matchedAllow.has(rule.id)) {
      violations.push({
        location: "package",
        path: rule.pattern,
        rule: `${rule.id}:missing`,
        class: rule.class,
        reason: `required for this mode but absent: ${rule.reason}`,
      });
    }
  }

  if (modePolicy.integrity !== null) {
    violations.push(
      ...integrityViolations(files, modePolicy.integrity.manifest, modePolicy.integrity.pack),
    );
  }

  if (snapshot.archiveBytes > modePolicy.budget.archiveBytesMax) {
    violations.push({
      location: "package",
      path: "app.asar",
      rule: "archive-size-budget",
      class: "size",
      reason: `${snapshot.archiveBytes} bytes exceeds the ${mode} budget of ${modePolicy.budget.archiveBytesMax}`,
    });
  }
  if (snapshot.outsideResourceBytes > modePolicy.budget.outsideArchiveBytesMax) {
    violations.push({
      location: "package",
      path: "Resources (outside app.asar)",
      rule: "outside-archive-size-budget",
      class: "size",
      reason: `${snapshot.outsideResourceBytes} bytes exceeds the ${mode} budget of ${modePolicy.budget.outsideArchiveBytesMax}`,
    });
  }

  const sorted = [...violations].sort(compareViolations);
  return {
    mode,
    policyVersion: policy.policyVersion,
    passed: sorted.length === 0,
    counts: { files: files.length, allowed: allowed.length, violations: sorted.length },
    sizes: {
      archiveBytes: snapshot.archiveBytes,
      archiveBytesMax: modePolicy.budget.archiveBytesMax,
      outsideResourceBytes: snapshot.outsideResourceBytes,
      outsideResourceBytesMax: modePolicy.budget.outsideArchiveBytesMax,
    },
    allowed,
    violations: sorted,
  };
}

export function formatReport(report: GuardReport): string {
  const lines = [
    `package guard: ${report.mode} policy ${report.policyVersion}: ${report.passed ? "PASS" : "FAIL"}`,
    `  files ${report.counts.files}, allowed map assets ${report.counts.allowed}, violations ${report.counts.violations}`,
    `  app.asar ${report.sizes.archiveBytes} / ${report.sizes.archiveBytesMax} bytes; resources outside the archive ${report.sizes.outsideResourceBytes} / ${report.sizes.outsideResourceBytesMax} bytes`,
  ];
  for (const violation of report.violations) {
    lines.push(
      `  FORBIDDEN [${violation.rule}] (${violation.class}) ${violation.location}:${violation.path}`,
      `      why: ${violation.reason}`,
    );
  }
  return `${lines.join("\n")}\n`;
}
