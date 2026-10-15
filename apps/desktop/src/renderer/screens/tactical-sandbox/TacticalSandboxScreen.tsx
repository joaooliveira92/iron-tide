import { Sandbox } from "./sandbox/index.js";

export interface TacticalSandboxScreenProps {
  readonly sessionId: string;
}

/**
 * Standalone harness for Milestone 2 (movement, spotting, gunnery, armor,
 * weather) and Milestone 3 (torpedoes, mines, submarines, coastal defenses,
 * smoke, damage control) tactical mechanics. Every field on screen is copied
 * straight from resolveTacticalBattle's response — nothing here re-derives
 * combat outcomes.
 */
export function TacticalSandboxScreen({ sessionId }: TacticalSandboxScreenProps) {
  return (
    <Sandbox.Provider sessionId={sessionId}>
      <Sandbox.Body />
    </Sandbox.Provider>
  );
}
