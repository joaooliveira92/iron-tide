import type {
  BattleInstance,
  BattleResult,
  CampaignSnapshot,
  NationState,
} from "@bluewave/campaign";
import { campaignMonthId } from "@bluewave/campaign";
import { computeManifestHash, resolveBattleAuto } from "@bluewave/combat";
import { canonicalSerialize } from "@bluewave/deterministic";
import { RandomLedger } from "@bluewave/random";

// Tactical replay verification (ADR-0034 decision 2, ticket 07).
//
// A battle's minute-by-minute tactical state is DERIVED_REBUILDABLE: it is
// deterministically re-resolved from the battle's manifest + seed rather than
// persisted as a mid-battle checkpoint. This verifier turns that decision into
// the actionable replay check that closes REL-1 §22 "replay at tactical
// checkpoints": for every battle the snapshot records as resolved, re-run
// `resolveBattleAuto` from the stored `BattleManifest` (whose canonical hash
// drives the seed) + the snapshot's committed combatant state + the battle
// area's committed strategic weather + the ruleset/formula/rng version pins,
// and compare the recomputed outcome against the recorded `BattleInstance.result`
// (winner/loser, per-side losses, damageReport).
//
// A divergence is reported deterministically (first diverging field, stable
// structured diagnostic). `resultHash` is a transient field of
// `BattleResolutionResult` and is NOT compared — only the persisted campaign
// `BattleResult` surface (ADR-0034, ticket 07). Battle autosaves / minute
// checkpoints are out of scope (deferred with the full save-package model).

type AutoResolutionManifest = Parameters<typeof resolveBattleAuto>[0]["manifest"];

/** The persisted `BattleResult` surface the verifier compares. */
type RecordedBattleSurface = Pick<
  BattleResult,
  "winnerId" | "loserId" | "attackerLosses" | "defenderLosses" | "damageReport"
>;

export type TacticalDivergenceField = keyof RecordedBattleSurface;

export interface TacticalBattleDivergence {
  /** First (canonical field order) recorded-vs-recomputed mismatch. */
  field: TacticalDivergenceField;
  recorded: unknown;
  recomputed: unknown;
}

export interface TacticalBattleVerification {
  battleId: string;
  match: boolean;
  divergence?: TacticalBattleDivergence;
  /** Stable diagnostic code when the battle could not be re-resolved at all. */
  diagnostic?: string;
}

export interface TacticalReplayResult {
  match: boolean;
  /** One entry per resolved battle, in canonical battle array order. */
  battles: TacticalBattleVerification[];
}

const COMPARISON_FIELDS: TacticalDivergenceField[] = [
  "winnerId",
  "loserId",
  "attackerLosses",
  "defenderLosses",
  "damageReport",
];

/** Locate the stored manifest for a battle by its canonical `manifestHash`. */
function resolveBattleManifest(
  snapshot: CampaignSnapshot,
  battle: BattleInstance,
): AutoResolutionManifest | null {
  if (battle["manifestHash"] === undefined) return null;
  const manifests = snapshot["wars"]["battleManifests"] ?? [];
  const found = manifests.find((m) => m["manifestHash"] === battle["manifestHash"]);
  return found ? (found as unknown as AutoResolutionManifest) : null;
}

function firstDivergence(
  recorded: RecordedBattleSurface,
  recomputed: RecordedBattleSurface,
): TacticalBattleDivergence | undefined {
  for (const field of COMPARISON_FIELDS) {
    const a = canonicalSerialize(recorded[field]);
    const b = canonicalSerialize(recomputed[field]);
    if (a !== b) {
      return { field, recorded: recorded[field], recomputed: recomputed[field] };
    }
  }
  return undefined;
}

/** The campaign `BattleResult` surface `resolveBattleAuto` recomputes, mirrored
 *  from the month pipeline's `toCampaignBattleResult` mapping. */
function recomputedSurface(auto: {
  winnerId: string | null;
  loserId: string | null;
  attackerSunkIds: string[];
  defenderSunkIds: string[];
  damageReport: Record<string, import("@bluewave/contracts").SafeInt>;
}): RecordedBattleSurface {
  return {
    winnerId: auto.winnerId,
    loserId: auto.loserId,
    attackerLosses: [...auto.attackerSunkIds].sort(),
    defenderLosses: [...auto.defenderSunkIds].sort(),
    damageReport: auto.damageReport,
  };
}

export class TacticalReplayVerifier {
  verify(snapshot: CampaignSnapshot, campaignSeed: string): TacticalReplayResult {
    // The authoritative campaign month id (same derivation as MonthExecutor):
    // the battle was resolved at the month for the snapshot's turn number.
    const campaignMonth = campaignMonthId(
      snapshot["startYear"],
      snapshot["startMonth"],
      snapshot["turnNumber"] as number,
    );

    const resolved = snapshot["wars"]["battles"].filter(
      (b) => b["phase"] === "resolved" && b["result"] !== undefined,
    );

    const battles: TacticalBattleVerification[] = [];
    for (const battle of resolved) {
      battles.push(this.verifyBattle(snapshot, battle, campaignSeed, campaignMonth));
    }

    return { match: battles.every((b) => b.match), battles };
  }

  private verifyBattle(
    snapshot: CampaignSnapshot,
    battle: BattleInstance,
    campaignSeed: string,
    campaignMonth: string,
  ): TacticalBattleVerification {
    const manifest = resolveBattleManifest(snapshot, battle);
    if (!manifest) {
      return {
        battleId: battle["id"],
        match: false,
        diagnostic: "TACTICAL_MANIFEST_NOT_FOUND",
      };
    }

    // The stored manifest must be internally consistent: its content hash must
    // equal its own `manifestHash` field. A content edit that does not update
    // the hash field (or a corrupted reference) is tamper — a stable
    // diagnostic, not a silent re-resolution against altered inputs.
    if (computeManifestHash(manifest) !== manifest["manifestHash"]) {
      return {
        battleId: battle["id"],
        match: false,
        diagnostic: "TACTICAL_MANIFEST_TAMPERED",
      };
    }

    const attacker = snapshot["nations"].get(battle["attackerId"]);
    const defender = snapshot["nations"].get(battle["defenderId"]);
    if (!attacker || !defender) {
      return {
        battleId: battle["id"],
        match: false,
        diagnostic: "TACTICAL_NATION_MISSING",
      };
    }

    const strategicWeather = snapshot["strategicWeather"].find(
      (s) => s["areaId"] === battle["areaId"],
    );
    if (!strategicWeather) {
      return {
        battleId: battle["id"],
        match: false,
        diagnostic: "TACTICAL_WEATHER_MISSING",
      };
    }

    let auto: ReturnType<typeof resolveBattleAuto>;
    try {
      auto = resolveBattleAuto({
        battleId: battle["id"],
        areaId: battle["areaId"],
        campaignMonth,
        manifest,
        attacker: this.combatant(attacker, snapshot),
        defender: this.combatant(defender, snapshot),
        strategicWeather,
        campaignSeed,
        rulesetVersion: snapshot["rulesetVersion"],
        formulaVersion: manifest["formulaVersion"],
        rngVersion: manifest["rngVersion"],
        randomLedger: new RandomLedger(),
      });
    } catch (e) {
      const code =
        e instanceof Error && "code" in e && typeof (e as { code?: unknown }).code === "string"
          ? ((e as { code: string }).code as string)
          : "TACTICAL_REPLAY_ERROR";
      return {
        battleId: battle["id"],
        match: false,
        diagnostic: `${code}: ${(e as Error).message ?? String(e)}`,
      };
    }

    const recomputed = recomputedSurface(auto);
    const recorded: RecordedBattleSurface = battle["result"] as RecordedBattleSurface;
    const divergence = firstDivergence(recorded, recomputed);
    return divergence
      ? { battleId: battle["id"], match: false, divergence }
      : { battleId: battle["id"], match: true };
  }

  private combatant(
    nation: NationState,
    snapshot: CampaignSnapshot,
  ): {
    nationId: string;
    ships: NationState["fleets"][number]["ships"];
    designs: CampaignSnapshot["designs"];
    divisions: NationState["divisions"];
  } {
    return {
      nationId: nation["id"],
      ships: nation["fleets"].flatMap((f) => f["ships"]),
      designs: snapshot["designs"],
      divisions: nation["divisions"],
    };
  }
}
