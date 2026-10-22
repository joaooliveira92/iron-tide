import type {
  ArmamentAccessStatus,
  ArmamentResolutionFinding,
  ArmamentFindingSeverity,
  ResolvedArmament,
} from "@bluewave/armament";
import { toCompiledArmamentMount } from "@bluewave/armament";
import type { CompiledWeaponArmament, ShipContext } from "./compileShared.js";
import { nationHasArmamentContent, resolveInstalledWeapon } from "./armamentContent.js";
import type { Finding, Remedy, Severity } from "./findings.js";
import { placementTarget } from "./findings.js";
import type { NationNavalProfile } from "./nationProfile.js";

const SEVERITY_MAP: Readonly<Record<ArmamentFindingSeverity, Severity>> = {
  BLOCKING: "BLOCKING",
  WARNING: "WARNING",
  ADVISORY: "ADVISORY",
};

const CONSEQUENCE: Readonly<Record<Severity, string>> = {
  BLOCKING: "The design cannot be built with this weapon combination as specified.",
  CRITICAL: "The design is unsafe with this weapon combination as specified.",
  WARNING: "The weapon is legal but notable; review it before ordering.",
  ADVISORY: "The weapon resolves; the note is informational.",
};

function remediesFor(code: string): readonly Remedy[] {
  return [
    { id: "review_armament", description: `Review the armament content for ${code}.` },
    { id: "alternative_weapon", description: "Choose a different gun, mount or ammunition." },
    { id: "update_content", description: "Update the design to content that resolves." },
  ];
}

function parameterInputs(
  parameters: Readonly<Record<string, string | number | boolean>>,
): Record<string, number> {
  const inputs: Record<string, number> = {};
  for (const [key, value] of Object.entries(parameters)) {
    if (typeof value === "number" && Number.isFinite(value)) inputs[key] = value;
  }
  return inputs;
}

export function mapArmamentFinding(
  finding: ArmamentResolutionFinding,
  instanceId: string,
): Finding {
  const severity = SEVERITY_MAP[finding.severity];
  const entity = `${finding.entity.kind}:${finding.entity.id}`;
  return {
    id: finding.code,
    severity,
    what: finding.message,
    why: `${entity}${finding.field === "" ? "" : `.${finding.field}`} (${describe(finding.parameters)}).`,
    consequence: CONSEQUENCE[severity],
    remedies: remediesFor(finding.code),
    evidence: {
      formulaId: "ARMAMENT",
      inputs: parameterInputs(finding.parameters),
      threshold: 0,
      value: 0,
    },
    parameters: { ...finding.parameters },
    subject: { targets: [placementTarget(instanceId)] },
  };
}

function describe(parameters: Readonly<Record<string, string | number | boolean>>): string {
  const parts = Object.keys(parameters)
    .sort()
    .map((k) => `${k}=${String(parameters[k])}`);
  return parts.length === 0 ? "no parameters" : parts.join(", ");
}

export function mapArmamentFindings(
  findings: readonly ArmamentResolutionFinding[],
  instanceId: string,
): Finding[] {
  return findings.map((f) => mapArmamentFinding(f, instanceId));
}

export function componentAccessOf(
  profile: NationNavalProfile | undefined,
): Record<string, ArmamentAccessStatus> {
  const access: Record<string, ArmamentAccessStatus> = {};
  for (const [familyId, entry] of Object.entries(profile?.componentAccess ?? {})) {
    access[familyId] = entry.status;
  }
  return access;
}

const resolvableCache = new WeakMap<ShipContext, Map<string, ReadonlySet<string>>>();

export function resolvableWeaponFamilies(
  ctx: ShipContext,
  nationId: string,
): ReadonlySet<string> | null {
  const content = ctx.armamentContent ?? null;
  if (content === null || !nationHasArmamentContent(content, nationId)) return null;
  let byNation = resolvableCache.get(ctx);
  if (byNation === undefined) {
    byNation = new Map();
    resolvableCache.set(ctx, byNation);
  }
  const cached = byNation.get(nationId);
  if (cached !== undefined) return cached;
  const access = componentAccessOf(ctx.navalProfile);
  const resolvable = new Set<string>();
  for (const family of content.gunFamilies) {
    const resolution = resolveInstalledWeapon({
      content,
      components: ctx.catalogue,
      nationId,
      familyId: family.id,
      gunCount: 1,
      month: ctx.month,
      unlockedTechnologyIds: ctx.unlockedTechs,
      componentAccess: access,
    });
    if (resolution.resolved !== null) resolvable.add(family.id);
  }
  byNation.set(nationId, resolvable);
  return resolvable;
}

export function toCompiledWeaponArmament(
  resolved: ResolvedArmament,
  mountType: string,
  instanceId: string,
): CompiledWeaponArmament {
  return toCompiledArmamentMount(resolved, mountType, instanceId);
}
