import { useSandbox } from "../sandbox-context.js";
import { SandboxAutoResolutionCard } from "./SandboxAutoResolutionCard.js";
import { SandboxTacticalOutcomeCard } from "./SandboxTacticalOutcomeCard.js";

export function SandboxOutcomeCard() {
  const { state } = useSandbox();
  const autoResolution = state.autoResolution;
  const outcome = state.tacticalOutcome;
  return (
    <>
      {autoResolution !== null && <SandboxAutoResolutionCard resolution={autoResolution} />}
      {outcome !== null && <SandboxTacticalOutcomeCard outcome={outcome} />}
    </>
  );
}
