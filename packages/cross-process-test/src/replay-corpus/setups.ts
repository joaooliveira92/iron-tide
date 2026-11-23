import type { CampaignSnapshot } from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";

import type { ReplaySetupId } from "./format.js";
import { raiderInterception } from "./raider-setup.js";

const ARMED_FIREPOWER = SafeInt(400);
const COMMISSIONED_SHIP = "aut_tegetthoff";
const ADRIATIC_NATIONS: readonly string[] = ["austria_hungary", "italy"];
const MALTA_NATIONS: readonly string[] = ["austria_hungary", "uk"];

function armedWar(armedNations: readonly string[], snapshot: CampaignSnapshot): CampaignSnapshot {
  const nations = new Map(snapshot.nations);
  for (const nationId of armedNations) {
    const nation = nations.get(nationId);
    if (nation === undefined) continue;
    nations.set(nationId, {
      ...nation,
      fleets: nation.fleets.map((fleet) => ({
        ...fleet,
        ships: fleet.ships.map((ship) => ({
          ...ship,
          firepower: ARMED_FIREPOWER,
          isUnderConstruction: ship.id === COMMISSIONED_SHIP ? false : ship.isUnderConstruction,
        })),
      })),
    });
  }
  return { ...snapshot, nations };
}

export const SETUPS: Readonly<
  Record<ReplaySetupId, (snapshot: CampaignSnapshot) => CampaignSnapshot>
> = {
  "armed-adriatic-war": (snapshot) => armedWar(ADRIATIC_NATIONS, snapshot),
  "armed-malta-war": (snapshot) => armedWar(MALTA_NATIONS, snapshot),
  "certain-construction-events": (snapshot) => snapshot,
  "unrest-phase": (snapshot) => snapshot,
  "raider-interception": raiderInterception,
};
