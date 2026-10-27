import type {
  BattleInstance,
  BattleResult,
  CampaignSnapshot,
  NationState,
} from "@bluewave/campaign";
import { campaignMonthId } from "@bluewave/campaign";
import { resolve } from "@bluewave/combat";
import type { GunneryRadarRules } from "@bluewave/combat/battleResolution";
import type { MissilesRules } from "@bluewave/content-schema";
import { computeManifestHash } from "@bluewave/combat/generation";
import { canonicalSerialize } from "@bluewave/deterministic";
import { RandomLedger } from "@bluewave/random";

type AutoResolutionManifest = Parameters<typeof resolve>[0]["manifest"];

type RecordedBattleSurface = Pick<
  BattleResult,
  "winnerId" | "loserId" | "attackerLosses" | "defenderLosses" | "damageReport"
>;

export type TacticalDivergenceField = keyof RecordedBattleSurface;

export interface TacticalBattleDivergence {
  field: TacticalDivergenceField;
  recorded: unknown;
  recomputed: unknown;
}

export interface TacticalBattleVerification {
  battleId: string;
  match: boolean;
  divergence?: TacticalBattleDivergence;
  diagnostic?: string;
}

export interface TacticalReplayResult {
  match: boolean;
  battles: TacticalBattleVerification[];
}

const COMPARISON_FIELDS: TacticalDivergenceField[] = [
  "winnerId",
  "loserId",
  "attackerLosses",
  "defenderLosses",
  "damageReport",
];

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
  verify(
    snapshot: CampaignSnapshot,
    campaignSeed: string,
    gunneryRadar?: GunneryRadarRules,
    missilesRules?: MissilesRules,
  ): TacticalReplayResult {
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
      battles.push(
        this.verifyBattle(
          snapshot,
          battle,
          campaignSeed,
          campaignMonth,
          gunneryRadar,
          missilesRules,
        ),
      );
    }

    return { match: battles.every((b) => b.match), battles };
  }

  private verifyBattle(
    snapshot: CampaignSnapshot,
    battle: BattleInstance,
    campaignSeed: string,
    campaignMonth: string,
    gunneryRadar: GunneryRadarRules | undefined,
    missilesRules: MissilesRules | undefined,
  ): TacticalBattleVerification {
    const manifest = resolveBattleManifest(snapshot, battle);
    if (!manifest) {
      return {
        battleId: battle["id"],
        match: false,
        diagnostic: "TACTICAL_MANIFEST_NOT_FOUND",
      };
    }

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

    let auto: ReturnType<typeof resolve>;
    try {
      auto = resolve({
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
        ...(gunneryRadar === undefined ? {} : { gunneryRadar }),
        ...(missilesRules === undefined ? {} : { missilesRules }),
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
