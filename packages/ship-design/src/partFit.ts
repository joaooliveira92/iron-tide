import { canonicalSerialize, compareCodePoints } from "@bluewave/deterministic";
import type {
  FlattenedPart,
  LoadoutData,
  NestedLoadoutEntry,
  PlatformData,
  ShipTypeRequirement,
  SlotData,
  SlotTemplateData,
} from "@bluewave/content-schema";
import {
  evaluateConstraints,
  gunChildren,
  specAt,
  type ResolvedFitPart,
} from "./partFitConstraints.js";
import {
  FIT_FINDING_CODES,
  type FitAmmunitionCompatibility,
  type FitAppliedWaiver,
  type FitDataIssue,
  type FitDataIssueCode,
  type FitDetail,
  type FitFinding,
  type FitFindingCode,
  type FitMountCountRanges,
  type FitNationInput,
  type FitResult,
  type FitUnresolvedRelationship,
} from "./partFitTypes.js";
import { isMonth } from "./partLifecycle.js";

const DEFAULT_ENTRY_MOUNT_COUNT = 1;

export interface FitCatalogue {
  readonly parts: readonly FlattenedPart[];
  readonly slotTemplates: readonly SlotTemplateData[];
  readonly platforms: readonly PlatformData[];
}

export interface FitConditions {
  readonly nation?: FitNationInput;
  readonly ammunitionCompatibility?: FitAmmunitionCompatibility;
  readonly mountCountRanges?: FitMountCountRanges;
  readonly unlockedTechnologies?: readonly string[];
  readonly shipTypeRequirements?: readonly ShipTypeRequirement[];
}

export interface FitInput {
  readonly catalogue: FitCatalogue;
  readonly loadout: LoadoutData;
  readonly month: string;
  readonly conditions?: FitConditions;
}

type Entry = NestedLoadoutEntry;

const CODE_RANK: ReadonlyMap<string, number> = new Map(FIT_FINDING_CODES.map((c, i) => [c, i]));

function compareFindings(a: FitFinding, b: FitFinding): number {
  return (
    (CODE_RANK.get(a.code) ?? 0) - (CODE_RANK.get(b.code) ?? 0) ||
    compareCodePoints(a.path, b.path) ||
    compareCodePoints(canonicalSerialize(a.detail), canonicalSerialize(b.detail))
  );
}

class Collector {
  readonly findings: FitFinding[] = [];
  readonly dataIssues: FitDataIssue[] = [];
  readonly waivers: FitAppliedWaiver[] = [];
  readonly unresolved: FitUnresolvedRelationship[] = [];

  finding(
    code: FitFindingCode,
    path: string,
    slot: string,
    part: string | null,
    detail: FitDetail,
    message: string,
  ): void {
    this.findings.push({ code, path, slot, part, detail, message });
  }

  data(code: FitDataIssueCode, path: string, detail: FitDetail, message: string): void {
    this.dataIssues.push({ code, path, detail, message });
  }
}

interface Ctx {
  readonly parts: ReadonlyMap<string, FlattenedPart>;
  readonly month: string;
  readonly monthOk: boolean;
  readonly platform: string;
  readonly platformSlots: ReadonlyMap<string, SlotData>;
  readonly nation: FitNationInput | undefined;
  readonly ammo: FitAmmunitionCompatibility | undefined;
  readonly countRanges: FitMountCountRanges | undefined;
  readonly unlocked: ReadonlySet<string> | undefined;
  readonly out: Collector;
}

interface PlacedEntry {
  readonly path: string;
  readonly slot: SlotData;
  readonly entry: Entry;
  readonly part: FlattenedPart;
}

function resolveSlots(
  raw: readonly SlotData[],
  owner: string,
  out: Collector,
): ReadonlyMap<string, SlotData> {
  const byId = new Map<string, SlotData>();
  for (const slot of raw) {
    if (byId.has(slot.id)) {
      out.data(
        "FIT_DATA_DUPLICATE_SLOT",
        `${owner}/slots/${slot.id}`,
        { slot: slot.id },
        `Slot '${slot.id}' is declared more than once on ${owner}.`,
      );
      continue;
    }
    byId.set(slot.id, slot);
  }
  const resolved = new Map<string, SlotData>();
  for (const [id, slot] of byId) {
    if (slot.mirrors === undefined) {
      resolved.set(id, slot);
      continue;
    }
    const sibling = byId.get(slot.mirrors);
    if (sibling === undefined || sibling.mirrors !== undefined) {
      out.data(
        "FIT_DATA_BAD_MIRROR",
        `${owner}/slots/${id}`,
        { slot: id, mirrors: slot.mirrors },
        `Slot '${id}' mirrors '${slot.mirrors}', which is ${sibling === undefined ? "not declared" : "itself a mirror"}.`,
      );
      continue;
    }
    resolved.set(id, { ...sibling, id });
  }
  return resolved;
}

function groupBySlot(
  entries: readonly { readonly slot: string; readonly entry: Entry }[],
): Map<string, Entry[]> {
  const grouped = new Map<string, Entry[]>();
  for (const { slot, entry } of entries) {
    const list = grouped.get(slot);
    if (list === undefined) grouped.set(slot, [entry]);
    else list.push(entry);
  }
  return grouped;
}

function canonicalEntries(entries: readonly Entry[]): readonly Entry[] {
  return entries
    .map((entry) => ({ entry, key: canonicalSerialize(entry) }))
    .sort(
      (a, b) => compareCodePoints(a.entry.part, b.entry.part) || compareCodePoints(a.key, b.key),
    )
    .map((e) => e.entry);
}

const mountCountOf = (entry: Entry): number => entry.mountCount ?? DEFAULT_ENTRY_MOUNT_COUNT;

interface Parent {
  readonly resolved: ResolvedFitPart;
  readonly entry: Entry;
  readonly mountCount: number;
}

function evaluateSlots(
  ctx: Ctx,
  slots: ReadonlyMap<string, SlotData>,
  byslot: ReadonlyMap<string, readonly Entry[]>,
  basePath: string,
  parent: Parent | null,
  placed: PlacedEntry[] | null,
): void {
  const scale = parent === null ? 1 : parent.mountCount;
  const slotIds = [...new Set([...slots.keys(), ...byslot.keys()])].sort(compareCodePoints);
  for (const slotId of slotIds) {
    const entries = canonicalEntries(byslot.get(slotId) ?? []);
    const slot = slots.get(slotId);
    const ordinals = new Map<string, number>();
    const pathOf = (entry: Entry): string => {
      const n = (ordinals.get(entry.part) ?? 0) + 1;
      ordinals.set(entry.part, n);
      return `${basePath}entries/${slotId}/${entry.part}#${n}`;
    };
    if (slot === undefined) {
      for (const entry of entries) {
        ctx.out.finding(
          "FIT_UNKNOWN_SLOT",
          pathOf(entry),
          slotId,
          entry.part,
          { owner: parent === null ? ctx.platform : parent.resolved.part.id },
          `Slot '${slotId}' does not exist on ${parent === null ? `platform '${ctx.platform}'` : `part '${parent.resolved.part.id}'`}.`,
        );
      }
      continue;
    }
    const total = entries.reduce((sum, e) => sum + mountCountOf(e), 0);
    const range = slot.mountCount;
    if (range !== undefined) {
      const min = range.min * scale;
      const max = range.max * scale;
      const detail = { total, min, max, perParentUnit: scale };
      if (total > max) {
        ctx.out.finding(
          "FIT_COUNT_EXCEEDED",
          `${basePath}slots/${slotId}`,
          slotId,
          null,
          detail,
          `Slot '${slotId}' holds ${total} units; the most it accepts is ${max}.`,
        );
      } else if (total < min) {
        ctx.out.finding(
          "FIT_COUNT_BELOW_MINIMUM",
          `${basePath}slots/${slotId}`,
          slotId,
          null,
          detail,
          `Slot '${slotId}' holds ${total} units; it needs at least ${min}.`,
        );
      }
    }
    if (slot.sameParts === true && new Set(entries.map((e) => e.part)).size > 1) {
      ctx.out.finding(
        "FIT_CONSTRAINT_VIOLATED",
        `${basePath}slots/${slotId}`,
        slotId,
        null,
        { constraint: "sameParts", parts: [...new Set(entries.map((e) => e.part))] },
        `Slot '${slotId}' requires one part, but holds several.`,
      );
    }
    for (const entry of entries) {
      const path = pathOf(entry);
      evaluateEntry(ctx, slot, entry, path, parent, placed);
    }
  }
}

function evaluateEntry(
  ctx: Ctx,
  slot: SlotData,
  entry: Entry,
  path: string,
  parent: Parent | null,
  placed: PlacedEntry[] | null,
): void {
  const { out } = ctx;
  const part = ctx.parts.get(entry.part);
  if (part === undefined) {
    out.data(
      "FIT_DATA_UNKNOWN_PART",
      path,
      { part: entry.part, slot: slot.id },
      `Entry names part '${entry.part}', which is not in the part catalogue.`,
    );
    return;
  }
  const mountCount = mountCountOf(entry);
  const resolved: ResolvedFitPart = { part, spec: specAt(part, ctx.month) };
  placed?.push({ path, slot, entry, part });

  const accepts = slot.accepts ?? [];
  if (!accepts.includes(part.provides)) {
    out.finding(
      "FIT_INTERFACE_MISMATCH",
      path,
      slot.id,
      part.id,
      { provides: part.provides, accepts: [...accepts] },
      `Part '${part.id}' provides '${part.provides}'; slot '${slot.id}' accepts ${accepts.join(", ")}.`,
    );
  } else {
    const nestedGuns: ResolvedFitPart[] = [];
    for (const child of gunChildren(entry)) {
      const gun = ctx.parts.get(child.part);
      if (gun !== undefined) nestedGuns.push({ part: gun, spec: specAt(gun, ctx.month) });
    }
    for (const outcome of evaluateConstraints({
      slot,
      subject: resolved,
      mountCount,
      parent: parent?.resolved ?? null,
      nestedGuns,
    })) {
      if (outcome.kind === "VIOLATED") {
        out.finding(
          "FIT_CONSTRAINT_VIOLATED",
          path,
          slot.id,
          part.id,
          { constraint: outcome.constraint, ...outcome.detail },
          `Part '${part.id}' violates '${outcome.constraint}' of slot '${slot.id}'.`,
        );
      } else if (outcome.kind === "UNEVALUABLE") {
        out.data(
          "FIT_DATA_CONSTRAINT_UNEVALUABLE",
          path,
          { constraint: outcome.constraint, slot: slot.id, part: part.id, ...outcome.detail },
          `Constraint '${outcome.constraint}' of slot '${slot.id}' cannot be decided for part '${part.id}'.`,
        );
      } else {
        out.waivers.push({ path, ...outcome.waiver });
      }
    }
    if (part.provides === "ammunition" && parent !== null) {
      checkAmmunition(ctx, path, slot, part, parent);
    }
  }

  parameters(ctx, entry, part, slot, path);
  const countRange = ctx.countRanges?.[part.id];
  if (
    countRange !== undefined &&
    (mountCount < countRange.min ||
      mountCount > countRange.max ||
      (mountCount - countRange.min) % countRange.step !== 0)
  ) {
    out.finding(
      "FIT_CONSTRAINT_VIOLATED",
      path,
      slot.id,
      part.id,
      { constraint: "mountCount", value: mountCount, ...countRange },
      `mountCount ${mountCount} is outside ${countRange.min}..${countRange.max} (step ${countRange.step}) of '${part.id}'.`,
    );
  }
  shape(ctx, entry, slot, path);
  lifecycle(ctx, part, slot, path);
  nationAccess(ctx, part, slot, path, resolved);
  placement(ctx, entry, slot, path, part);
  if (entry.feedsFrom !== undefined && !ctx.platformSlots.has(entry.feedsFrom)) {
    out.finding(
      "FIT_UNKNOWN_SLOT",
      `${path}/feedsFrom`,
      entry.feedsFrom,
      part.id,
      { feedsFrom: entry.feedsFrom, owner: ctx.platform },
      `feedsFrom names slot '${entry.feedsFrom}', which platform '${ctx.platform}' does not have.`,
    );
  }

  const ownSlots = resolveSlots(part.slots ?? [], `part '${part.id}'`, out);
  const nested = Object.entries(entry.entries ?? {}).flatMap(([childSlot, list]) =>
    list.map((child) => ({ slot: childSlot, entry: child })),
  );
  if (ownSlots.size > 0 || nested.length > 0) {
    evaluateSlots(
      ctx,
      ownSlots,
      groupBySlot(nested),
      `${path}/`,
      { resolved, entry, mountCount },
      null,
    );
  }
}

function checkAmmunition(
  ctx: Ctx,
  path: string,
  slot: SlotData,
  part: FlattenedPart,
  parent: Parent,
): void {
  const allowed = ctx.ammo?.[part.id];
  if (allowed === undefined) return;
  const guns =
    parent.resolved.part.family === "gun"
      ? [parent.resolved.part.id]
      : gunChildren(parent.entry).map((g) => g.part);
  const rejected = [...new Set(guns)].filter((g) => !allowed.includes(g)).sort(compareCodePoints);
  if (rejected.length > 0) {
    ctx.out.finding(
      "FIT_CONSTRAINT_VIOLATED",
      path,
      slot.id,
      part.id,
      {
        constraint: "ammunitionCompatibleGun",
        guns: rejected,
        allowed: [...allowed].sort(compareCodePoints),
      },
      `Ammunition '${part.id}' does not feed gun(s) ${rejected.join(", ")}.`,
    );
  }
}

function parameters(
  ctx: Ctx,
  entry: Entry,
  part: FlattenedPart,
  slot: SlotData,
  path: string,
): void {
  const declared = part.parameters ?? {};
  const given = entry.params ?? {};
  for (const name of Object.keys(declared).sort(compareCodePoints)) {
    const range = declared[name];
    const value = given[name];
    if (range === undefined) continue;
    if (value === undefined) {
      ctx.out.data(
        "FIT_DATA_PARAMETER_MISSING",
        `${path}/params/${name}`,
        { parameter: name, part: part.id },
        `Part '${part.id}' declares parameter '${name}', which the entry does not set.`,
      );
    } else if (value < range.min || value > range.max || (value - range.min) % range.step !== 0) {
      ctx.out.finding(
        "FIT_CONSTRAINT_VIOLATED",
        `${path}/params/${name}`,
        slot.id,
        part.id,
        {
          constraint: `parameter:${name}`,
          value,
          min: range.min,
          max: range.max,
          step: range.step,
        },
        `Parameter '${name}' = ${value} is outside ${range.min}..${range.max} (step ${range.step}) of '${part.id}'.`,
      );
    }
  }
  for (const name of Object.keys(given).sort(compareCodePoints)) {
    if (declared[name] === undefined) {
      ctx.out.data(
        "FIT_DATA_PARAMETER_UNDECLARED",
        `${path}/params/${name}`,
        { parameter: name, part: part.id },
        `Entry sets parameter '${name}', which part '${part.id}' does not declare.`,
      );
    }
  }
}

function shape(ctx: Ctx, entry: Entry, slot: SlotData, path: string): void {
  if (slot.region !== undefined && entry.shape === undefined) {
    ctx.out.data(
      "FIT_DATA_SHAPE_MISSING",
      `${path}/shape`,
      { region: slot.region, slot: slot.id },
      `Armour-region slot '${slot.id}' needs a plate shape.`,
    );
  } else if (slot.region === undefined && entry.shape !== undefined) {
    ctx.out.data(
      "FIT_DATA_SHAPE_UNEXPECTED",
      `${path}/shape`,
      { slot: slot.id },
      `Slot '${slot.id}' is not an armour region; a plate shape does not belong on its entry.`,
    );
  }
}

function lifecycle(ctx: Ctx, part: FlattenedPart, slot: SlotData, path: string): void {
  if (ctx.unlocked !== undefined) {
    const missing = (part.lifecycle.requires ?? [])
      .filter((t) => !ctx.unlocked?.has(t))
      .sort(compareCodePoints);
    if (missing.length > 0) {
      ctx.out.finding(
        "FIT_TECHNOLOGY_LOCKED",
        path,
        slot.id,
        part.id,
        { missing },
        `Part '${part.id}' requires technology ${missing.join(", ")}, which is not unlocked.`,
      );
    }
  }
  if (!ctx.monthOk) return;
  const { availableFrom, availableUntil } = part.lifecycle;
  if (ctx.month < availableFrom) {
    ctx.out.finding(
      "FIT_NOT_YET_AVAILABLE",
      path,
      slot.id,
      part.id,
      { availableFrom, month: ctx.month },
      `Part '${part.id}' is available from ${availableFrom}; the design month is ${ctx.month}.`,
    );
  } else if (
    availableUntil !== undefined &&
    availableUntil !== null &&
    ctx.month >= availableUntil
  ) {
    const supersededBy = [...ctx.parts.values()]
      .filter((p) => p.lifecycle.supersedes?.includes(part.id) === true)
      .map((p) => p.id)
      .sort(compareCodePoints);
    ctx.out.finding(
      "FIT_UNAVAILABLE",
      path,
      slot.id,
      part.id,
      { availableUntil, month: ctx.month, supersededBy },
      `Part '${part.id}' is unavailable from ${availableUntil}; the design month is ${ctx.month}.`,
    );
  }
}

function nationAccess(
  ctx: Ctx,
  part: FlattenedPart,
  slot: SlotData,
  path: string,
  resolved: ResolvedFitPart,
): void {
  const nation = ctx.nation;
  if (nation === undefined) return;
  const deny = (reason: string, detail: FitDetail) =>
    ctx.out.finding(
      "FIT_NATION_ACCESS",
      path,
      slot.id,
      part.id,
      { nation: nation.nationId, reason, ...detail },
      `Nation '${nation.nationId}' may not use part '${part.id}' (${reason}).`,
    );
  if (part.nation !== undefined && part.nation !== nation.nationId) {
    deny("part_is_national", { partNation: part.nation });
  }
  if (nation.deniedParts?.includes(part.id) === true) deny("access_denied", {});
  const calibre = part.family === "gun" ? resolved.spec["calibreUm"] : undefined;
  if (
    nation.maxGunCalibreUm !== undefined &&
    typeof calibre === "number" &&
    calibre > nation.maxGunCalibreUm
  ) {
    deny("calibre_cap", { calibreUm: calibre, maxGunCalibreUm: nation.maxGunCalibreUm });
  }
}

function placement(
  ctx: Ctx,
  entry: Entry,
  slot: SlotData,
  path: string,
  part: FlattenedPart,
): void {
  const range = slot.stationPermille;
  if (range !== undefined) {
    const stations = [
      ...(entry.stationPermille === undefined ? [] : [entry.stationPermille]),
      ...(entry.units ?? []).map((u) => u.stationPermille),
    ];
    const outside = stations.filter((s) => s < range.from || s > range.to);
    if (outside.length > 0) {
      ctx.out.finding(
        "FIT_PLACEMENT",
        path,
        slot.id,
        part.id,
        { stationPermille: outside, from: range.from, to: range.to },
        `Station ${outside.join(", ")} is outside slot '${slot.id}' (${range.from}..${range.to} permille).`,
      );
    }
  }
  if (slot.side !== undefined) {
    const sides = [
      ...(entry.side === undefined ? [] : [entry.side]),
      ...(entry.units ?? []).flatMap((u) => (u.side === undefined ? [] : [u.side])),
    ];
    const wrong = [...new Set(sides.filter((s) => s !== slot.side))].sort(compareCodePoints);
    if (wrong.length > 0) {
      ctx.out.finding(
        "FIT_PLACEMENT",
        path,
        slot.id,
        part.id,
        { side: wrong, slotSide: slot.side },
        `Side ${wrong.join(", ")} does not match slot '${slot.id}' (${slot.side}).`,
      );
    }
  }
}

function magazineRelationships(ctx: Ctx, placed: readonly PlacedEntry[]): void {
  const magazines = placed.filter((p) => p.slot.accepts?.includes("magazine") === true);
  for (const p of placed) {
    const carriesAmmunition = Object.values(p.entry.entries ?? {}).some((list) =>
      list.some((child) => ctx.parts.get(child.part)?.provides === "ammunition"),
    );
    if (!carriesAmmunition && p.entry.feedsFrom === undefined) continue;
    const candidates =
      p.entry.feedsFrom !== undefined
        ? magazines.filter((m) => m.slot.id === p.entry.feedsFrom)
        : p.slot.zone !== undefined
          ? magazines.filter((m) => m.slot.zone === p.slot.zone)
          : [];
    const paths = candidates.map((m) => m.path).sort(compareCodePoints);
    if (paths.length === 1) continue;
    ctx.out.unresolved.push({
      code: paths.length === 0 ? "FIT_MAGAZINE_UNDETERMINED" : "FIT_MAGAZINE_AMBIGUOUS",
      path: p.path,
      candidates: paths,
      message:
        paths.length === 0
          ? "No magazine entry can be tied to this entry's ammunition; no rounds or magazine are assumed."
          : `${paths.length} magazine entries could feed this entry; none is chosen.`,
    });
  }
}

interface WalkedEntry {
  readonly slot: string;
  readonly entry: Entry;
  readonly resolved: ResolvedFitPart | null;
  readonly parent: ResolvedFitPart | null;
}

function walkEntries(
  ctx: Ctx,
  roots: readonly (Entry & { readonly slot: string })[],
): WalkedEntry[] {
  const out: WalkedEntry[] = [];
  const walk = (slot: string, entry: Entry, parent: ResolvedFitPart | null): void => {
    const part = ctx.parts.get(entry.part);
    const resolved = part === undefined ? null : { part, spec: specAt(part, ctx.month) };
    out.push({ slot, entry, resolved, parent });
    for (const [childSlot, children] of Object.entries(entry.entries ?? {})) {
      for (const child of children) walk(childSlot, child, resolved);
    }
  };
  for (const root of roots) walk(root.slot, root, null);
  return out;
}

function requirementHolds(
  ctx: Ctx,
  requirement: ShipTypeRequirement,
  candidate: WalkedEntry,
): boolean {
  const subject = candidate.resolved;
  if (subject === null) return false;
  const nestedGuns: ResolvedFitPart[] = [];
  for (const child of gunChildren(candidate.entry)) {
    const gun = ctx.parts.get(child.part);
    if (gun !== undefined) nestedGuns.push({ part: gun, spec: specAt(gun, ctx.month) });
  }
  const outcomes = evaluateConstraints({
    slot: {
      id: requirement.slot,
      accepts: [requirement.interface],
      constraints: requirement.constraints,
    },
    subject,
    mountCount: mountCountOf(candidate.entry),
    parent: candidate.parent,
    nestedGuns,
  });
  return outcomes.every((o) => o.kind !== "VIOLATED" && o.kind !== "UNEVALUABLE");
}

function evaluateTypeRequirements(
  ctx: Ctx,
  roots: readonly (Entry & { readonly slot: string })[],
  requirements: readonly ShipTypeRequirement[],
): void {
  if (requirements.length === 0) return;
  const walked = walkEntries(ctx, roots);
  for (const requirement of requirements) {
    const path = `typeRequires/${requirement.slot}`;
    const inSlot = walked
      .filter((w) => w.slot === requirement.slot)
      .sort(
        (a, b) =>
          compareCodePoints(a.entry.part, b.entry.part) ||
          compareCodePoints(canonicalSerialize(a.entry), canonicalSerialize(b.entry)),
      );
    if (inSlot.length === 0) {
      ctx.out.finding(
        "TYPE_REQUIRES_SLOT_MISSING",
        path,
        requirement.slot,
        null,
        { slot: requirement.slot },
        `The ship type requires a part in slot '${requirement.slot}', but the loadout fills none.`,
      );
      continue;
    }
    const providing = inSlot.filter((w) => w.resolved?.part.provides === requirement.interface);
    if (providing.length === 0) {
      ctx.out.finding(
        "TYPE_REQUIRES_INTERFACE_MISMATCH",
        path,
        requirement.slot,
        null,
        { slot: requirement.slot, interface: requirement.interface },
        `The ship type requires a '${requirement.interface}' in slot '${requirement.slot}', but no entry provides it.`,
      );
      continue;
    }
    const satisfying = providing.filter((w) => requirementHolds(ctx, requirement, w));
    if (satisfying.length === 0) {
      ctx.out.finding(
        "TYPE_REQUIRES_CONSTRAINT_VIOLATED",
        path,
        requirement.slot,
        providing[0]!.resolved?.part.id ?? null,
        { slot: requirement.slot, interface: requirement.interface },
        `The ship type requires a '${requirement.interface}' in slot '${requirement.slot}' meeting its constraints; none does.`,
      );
      continue;
    }
    const min = requirement.mountCountMin;
    if (min !== undefined) {
      const total = satisfying.reduce((sum, w) => sum + mountCountOf(w.entry), 0);
      if (total < min) {
        ctx.out.finding(
          "TYPE_REQUIRES_MOUNT_COUNT",
          path,
          requirement.slot,
          null,
          { slot: requirement.slot, interface: requirement.interface, total, min },
          `The ship type requires at least ${min} unit(s) of '${requirement.interface}' in slot '${requirement.slot}'; the loadout has ${total}.`,
        );
      }
    }
  }
}

function entryIdentityHolds(
  roots: readonly (Entry & { readonly slot?: string })[],
  out: Collector,
): boolean {
  const seen = new Map<string, string>();
  const onPath = new Set<object>();
  let ok = true;
  const walk = (entry: Entry, path: string): void => {
    if (onPath.has(entry)) {
      ok = false;
      out.data(
        "FIT_DATA_ENTRY_CYCLE",
        path,
        { part: entry.part },
        `Entry '${path}' contains itself.`,
      );
      return;
    }
    if (entry.id !== undefined) {
      const first = seen.get(entry.id);
      if (first === undefined) {
        seen.set(entry.id, path);
      } else {
        ok = false;
        out.data(
          "FIT_DATA_DUPLICATE_ENTRY_ID",
          path,
          { id: entry.id, first },
          `Entry id '${entry.id}' is used at '${first}' and at '${path}'.`,
        );
      }
    }
    onPath.add(entry);
    for (const [slot, children] of Object.entries(entry.entries ?? {})) {
      children.forEach((child, i) => walk(child, `${path}/${slot}[${i}]`));
    }
    onPath.delete(entry);
  };
  roots.forEach((root, i) => walk(root, `entries[${i}]`));
  return ok;
}

export function validateLoadoutFit(input: FitInput): FitResult {
  const conditions = input.conditions ?? {};
  const out = new Collector();
  const finish = (platform: string): FitResult => {
    const findings = [...out.findings].sort(compareFindings);
    const dataIssues = [...out.dataIssues].sort(
      (a, b) =>
        compareCodePoints(a.code, b.code) ||
        compareCodePoints(a.path, b.path) ||
        compareCodePoints(canonicalSerialize(a.detail), canonicalSerialize(b.detail)),
    );
    return {
      status:
        dataIssues.length > 0 ? "NOT_EVALUABLE" : findings.length > 0 ? "REJECTED" : "ACCEPTED",
      platform,
      month: input.month,
      findings,
      dataIssues,
      waivers: [...out.waivers].sort((a, b) => compareCodePoints(a.path, b.path)),
      unresolved: [...out.unresolved].sort((a, b) => compareCodePoints(a.path, b.path)),
    };
  };

  const monthOk = isMonth(input.month);
  if (!monthOk) {
    out.data(
      "FIT_DATA_BAD_MONTH",
      "month",
      { month: input.month },
      `The design month '${input.month}' is not YYYY-MM.`,
    );
  }
  const parts = new Map<string, FlattenedPart>();
  for (const part of input.catalogue.parts) {
    if (parts.has(part.id)) {
      out.data(
        "FIT_DATA_DUPLICATE_PART",
        `parts/${part.id}`,
        { part: part.id },
        `Part '${part.id}' is in the catalogue more than once.`,
      );
    } else {
      parts.set(part.id, part);
    }
  }
  const platform = input.catalogue.platforms.find((p) => p.id === input.loadout.platform);
  if (platform === undefined) {
    out.data(
      "FIT_DATA_UNKNOWN_PLATFORM",
      "platform",
      { platform: input.loadout.platform },
      `Platform '${input.loadout.platform}' is not declared.`,
    );
    return finish(input.loadout.platform);
  }
  if (monthOk && platform.lifecycle !== undefined) {
    const { availableFrom, availableUntil } = platform.lifecycle;
    if (input.month < availableFrom) {
      out.finding(
        "FIT_PLATFORM_NOT_YET_AVAILABLE",
        `platforms/${platform.id}`,
        "",
        null,
        { platform: platform.id, availableFrom },
        `Platform '${platform.id}' is not available before ${availableFrom}.`,
      );
    } else if (
      availableUntil !== undefined &&
      availableUntil !== null &&
      input.month >= availableUntil
    ) {
      out.finding(
        "FIT_PLATFORM_UNAVAILABLE",
        `platforms/${platform.id}`,
        "",
        null,
        { platform: platform.id, availableUntil },
        `Platform '${platform.id}' is no longer available from ${availableUntil}.`,
      );
    }
  }
  if (!entryIdentityHolds(input.loadout.entries, out)) return finish(platform.id);
  const rawSlots: SlotData[] = [];
  for (const templateId of platform.slotTemplates) {
    const template = input.catalogue.slotTemplates.find((t) => t.id === templateId);
    if (template === undefined) {
      out.data(
        "FIT_DATA_UNKNOWN_TEMPLATE",
        `platforms/${platform.id}/slotTemplates/${templateId}`,
        { template: templateId },
        `Platform '${platform.id}' uses slot template '${templateId}', which is not declared.`,
      );
    } else {
      rawSlots.push(...template.slots);
    }
  }
  rawSlots.push(...(platform.slots ?? []));
  const platformSlots = resolveSlots(rawSlots, `platform '${platform.id}'`, out);
  const ctx: Ctx = {
    parts,
    month: input.month,
    monthOk,
    platform: platform.id,
    platformSlots,
    nation: conditions.nation,
    ammo: conditions.ammunitionCompatibility,
    countRanges: conditions.mountCountRanges,
    unlocked: conditions.unlockedTechnologies && new Set(conditions.unlockedTechnologies),
    out,
  };
  const placed: PlacedEntry[] = [];
  evaluateSlots(
    ctx,
    platformSlots,
    groupBySlot(input.loadout.entries.map((entry) => ({ slot: entry.slot, entry }))),
    "",
    null,
    placed,
  );
  magazineRelationships(ctx, placed);
  evaluateTypeRequirements(ctx, input.loadout.entries, conditions.shipTypeRequirements ?? []);
  return finish(platform.id);
}

export function deriveAfterFit<T>(
  fit: FitResult,
  derive: () => T,
):
  | { readonly derived: true; readonly value: T; readonly fit: FitResult }
  | { readonly derived: false; readonly fit: FitResult } {
  return fit.status === "ACCEPTED"
    ? { derived: true, value: derive(), fit }
    : { derived: false, fit };
}
