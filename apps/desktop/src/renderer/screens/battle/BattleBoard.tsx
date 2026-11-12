import { Button } from "../../components/ui/button.js";
import { translate } from "../../lib/strings.js";
import { BattleMapPane } from "./BattleMapPane.js";
import { BattleSidebar } from "./BattleSidebar.js";
import { BattleToolbar } from "./BattleToolbar.js";
import { useBattleSession } from "./session/BattleSession.js";
import { TacticalStatusBar } from "./tactical/TacticalStatusBar.js";

export function BattleBoard() {
  const { state, actions } = useBattleSession();
  const { view, running, scale, ended, busy } = state;
  if (view === null) return null;
  return (
    <div className="mt-2 flex flex-col gap-2">
      <BattleToolbar />

      <div className="grid gap-2 lg:h-[clamp(26rem,62vh,48rem)] lg:grid-cols-[minmax(17rem,22rem)_minmax(0,1fr)]">
        <BattleSidebar />
        <BattleMapPane />
      </div>

      {!running && !ended && (
        <p className="text-xs text-muted-foreground">
          {translate("tactical.status.pending_orders")}
        </p>
      )}

      <TacticalStatusBar view={view} running={running} scale={scale} />

      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          data-testid="battle-submit"
          disabled={!ended || busy}
          onClick={() => actions.submit()}
        >
          Submit result
        </Button>
      </div>
    </div>
  );
}
