// packages/phase-engine/src/divisionCommands.ts
// Canonical application of the DESIGN-26 division commands (create / add /
// remove / change flagship / dissolve), used by the command_collection phase.
import type {
  CampaignSnapshot,
  CanonicalShipType,
  DivisionAssetView,
  PermanentDivision,
} from "@bluewave/campaign";
import {
  applyDivisionCommand,
  assertDivisionInvariants,
  DIVISION_MEMBERSHIP_CHANGE_INELIGIBLE,
  DIVISION_STATE_INVARIANT_FAILED,
  INITIAL_DIVISION_COHESION,
  INITIAL_DIVISION_EXPERIENCE,
  isShipOperational,
  VACANT,
} from "@bluewave/campaign";
import { classifyShip } from "@bluewave/combat";
import type {
  AddShipToDivisionCommand,
  ChangeDivisionFlagshipCommand,
  CommandBody,
  CreateDivisionCommand,
  DissolveDivisionCommand,
  RemoveShipFromDivisionCommand,
  ReorderDivisionShipsCommand,
} from "@bluewave/commands";
import { SafeInt } from "@bluewave/contracts";
import type { DiagnosticCollector } from "@bluewave/diagnostics";

function divisionAssetsFor(
  snapshot: CampaignSnapshot,
  nationId: string,
  shipIds: string[],
): NonNullable<Parameters<typeof assertDivisionInvariants>[1]> {
  const nation = snapshot["nations"].get(nationId);
  if (!nation) return [];
  const all = nation["fleets"].flatMap((f) => f["ships"]);
  const byId = new Map(all.map((s) => [s["id"], s]));
  const assets: DivisionAssetView[] = [];
  for (const id of shipIds) {
    const s = byId.get(id);
    if (!s) continue;
    let shipType = "BB" as CanonicalShipType;
    const design = snapshot["designs"].get(s["designVersionId"]);
    if (design) {
      try {
        shipType = classifyShip(design);
      } catch {
        shipType = "BB" as CanonicalShipType;
      }
    }
    assets.push({
      shipId: id,
      shipType,
      locationAreaId: s["locationAreaId"],
      isUnderConstruction: !isShipOperational(s),
    });
  }
  return assets;
}

export function applyDivisionCommandMonth(
  snapshot: CampaignSnapshot,
  body: CommandBody,
  campaignMonth: string,
  collector: DiagnosticCollector,
): CampaignSnapshot {
  if (body["type"] === "CreateDivision") {
    const cb = body as CreateDivisionCommand;
    const nation = snapshot["nations"].get(cb["nationId"]);
    if (!nation) {
      collector.addError("NATION_NOT_FOUND", `Nation ${cb["nationId"]} not found`, {
        stage: "command-collection",
      });
      return snapshot;
    }
    if (nation["divisions"].some((d) => d["divisionId"] === cb["divisionId"])) {
      collector.addError(
        DIVISION_MEMBERSHIP_CHANGE_INELIGIBLE,
        `Duplicate division ${cb["divisionId"]}`,
        {
          stage: "command-collection",
        },
      );
      return snapshot;
    }
    const assets = divisionAssetsFor(snapshot, cb["nationId"], cb["shipOrder"]);
    if (assets.length !== cb["shipOrder"].length) {
      collector.addError(DIVISION_MEMBERSHIP_CHANGE_INELIGIBLE, "One or more ships not found", {
        stage: "command-collection",
      });
      return snapshot;
    }
    const division: PermanentDivision = {
      divisionId: cb["divisionId"],
      nationId: cb["nationId"],
      shipOrder: [...cb["shipOrder"]],
      flagshipShipId: cb["shipOrder"][0]!,
      commanderOfficerId: VACANT,
      divisionRole: cb["divisionRole"] as PermanentDivision["divisionRole"],
      preferredFormation: cb["preferredFormation"] as PermanentDivision["preferredFormation"],
      experience: SafeInt(INITIAL_DIVISION_EXPERIENCE),
      cohesion: SafeInt(INITIAL_DIVISION_COHESION),
      locationAreaId:
        nation["fleets"].find((f) => f["ships"].some((s) => s["id"] === cb["shipOrder"][0]))?.[
          "locationAreaId"
        ] ?? "",
      creationMonth: campaignMonth,
      lastReorganizationMonth: campaignMonth,
      provenanceRefs: [],
      rulesetVersion: snapshot["rulesetVersion"],
      aggregateHash: "",
    };
    try {
      assertDivisionInvariants(division, assets, {});
    } catch (e) {
      collector.addError(
        DIVISION_STATE_INVARIANT_FAILED,
        `Division invariant failed: ${(e as Error).message}`,
        {
          stage: "command-collection",
        },
      );
      return snapshot;
    }
    const updated = applyDivisionCommand(
      division,
      { type: "create", shipId: cb["shipOrder"][0]!, creationMonth: campaignMonth },
      campaignMonth,
    );
    const nations = new Map(snapshot["nations"]);
    const nationNext = { ...nation, divisions: [...nation["divisions"], updated.division] };
    nations.set(cb["nationId"], nationNext);
    return { ...snapshot, nations };
  }

  if (
    body["type"] === "AddShipToDivision" ||
    body["type"] === "RemoveShipFromDivision" ||
    body["type"] === "ChangeDivisionFlagship" ||
    body["type"] === "ReorderDivisionShips" ||
    body["type"] === "DissolveDivision"
  ) {
    const cb = body as
      | AddShipToDivisionCommand
      | RemoveShipFromDivisionCommand
      | ChangeDivisionFlagshipCommand
      | ReorderDivisionShipsCommand
      | DissolveDivisionCommand;
    const nation = snapshot["nations"].get(cb["nationId"]);
    if (!nation) {
      collector.addError("NATION_NOT_FOUND", `Nation ${cb["nationId"]} not found`, {
        stage: "command-collection",
      });
      return snapshot;
    }
    const idx = nation["divisions"].findIndex((d) => d["divisionId"] === cb["divisionId"]);
    if (idx === -1) {
      collector.addError(
        DIVISION_MEMBERSHIP_CHANGE_INELIGIBLE,
        `Division ${cb["divisionId"]} not found`,
        {
          stage: "command-collection",
        },
      );
      return snapshot;
    }
    const division = nation["divisions"][idx]!;
    if (body["type"] === "ReorderDivisionShips") {
      // Commands are authorized against the month-start snapshot but applied in
      // order, so an earlier command this month may have changed the membership.
      // Re-check against the division being applied: a stale order must never be
      // able to drop an added ship, resurrect a removed one, or desync the flagship.
      const next = (body as ReorderDivisionShipsCommand)["shipOrder"];
      const current = division["shipOrder"];
      const stillValid =
        Array.isArray(next) &&
        next.length === current.length &&
        new Set(next).size === next.length &&
        next.every((id) => current.includes(id)) &&
        next[0] === division["flagshipShipId"];
      if (!stillValid) {
        collector.addError(
          DIVISION_MEMBERSHIP_CHANGE_INELIGIBLE,
          `Reorder of division ${cb["divisionId"]} no longer matches its current ships`,
          { stage: "command-collection" },
        );
        return snapshot;
      }
    }
    let updated: { division: PermanentDivision };
    try {
      let op:
        | { type: "remove_ship"; shipId: string }
        | { type: "add_ship"; shipId: string }
        | { type: "change_flagship"; newFlagshipShipId: string }
        | { type: "reorder"; shipOrder: string[] }
        | { type: "dissolve" };
      if (body["type"] === "AddShipToDivision")
        op = { type: "add_ship", shipId: (body as AddShipToDivisionCommand)["shipId"] };
      else if (body["type"] === "RemoveShipFromDivision")
        op = { type: "remove_ship", shipId: (body as RemoveShipFromDivisionCommand)["shipId"] };
      else if (body["type"] === "ChangeDivisionFlagship")
        op = {
          type: "change_flagship",
          newFlagshipShipId: (body as ChangeDivisionFlagshipCommand)["newFlagshipShipId"],
        };
      else if (body["type"] === "ReorderDivisionShips")
        op = {
          type: "reorder",
          shipOrder: [...(body as ReorderDivisionShipsCommand)["shipOrder"]],
        };
      else op = { type: "dissolve" };
      updated = applyDivisionCommand(division, op, campaignMonth);
    } catch (e) {
      collector.addError(
        DIVISION_STATE_INVARIANT_FAILED,
        `Division command failed: ${(e as Error).message}`,
        {
          stage: "command-collection",
        },
      );
      return snapshot;
    }
    let divisions = [...nation["divisions"]];
    if (body["type"] === "DissolveDivision") divisions.splice(idx, 1);
    else divisions[idx] = updated.division;
    const nations = new Map(snapshot["nations"]);
    const nationNext = { ...nation, divisions };
    nations.set(cb["nationId"], nationNext);
    return { ...snapshot, nations };
  }

  return snapshot;
}
