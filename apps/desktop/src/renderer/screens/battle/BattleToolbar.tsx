import {
  useBattleActions,
  useBattleCameraState,
  useBattleState,
} from "./session/battle-session-contexts.js";
import { TacticalToolbar } from "./tactical/TacticalToolbar.js";

export function BattleToolbar() {
  const state = useBattleState();
  const actions = useBattleActions();
  const { following } = useBattleCameraState();
  return (
    <TacticalToolbar
      following={following}
      running={state.running}
      scale={state.scale}
      busy={state.busy}
      ended={state.ended}
      canFocus={state.selectedPoint !== null}
      overlays={state.overlays}
      onToggleRunning={actions.toggleRunning}
      onScale={actions.setScale}
      onStep={actions.step}
      onFightToEnd={actions.fightToEnd}
      onZoomIn={actions.zoomIn}
      onZoomOut={actions.zoomOut}
      onFit={actions.fit}
      onFocus={actions.focus}
      onToggleFollow={actions.toggleFollow}
      onOverlay={actions.setOverlay}
      onNames={actions.setNames}
    />
  );
}
