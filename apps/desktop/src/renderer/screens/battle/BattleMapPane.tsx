import { translate } from "../../lib/strings.js";
import { useBattleSession } from "./session/BattleSession.js";
import { TacticalMap } from "./tactical/TacticalMap.js";

export function BattleMapPane() {
  const {
    state: { running, ended },
  } = useBattleSession();
  return (
    <div className="relative h-[24rem] min-w-0 lg:h-full">
      <TacticalMap>
        <TacticalMap.Canvas>
          <TacticalMap.Overlays />
          <TacticalMap.Units />
          <TacticalMap.Chrome />
        </TacticalMap.Canvas>
        <TacticalMap.Conditions />
        <TacticalMap.Bearing />
      </TacticalMap>
      {!running && !ended && (
        <div
          aria-hidden="true"
          data-testid="tactical-paused-banner"
          className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded bg-amber-500/90 px-4 py-1 text-sm font-bold tracking-widest text-black"
        >
          {translate("tactical.status.paused")}
        </div>
      )}
    </div>
  );
}
