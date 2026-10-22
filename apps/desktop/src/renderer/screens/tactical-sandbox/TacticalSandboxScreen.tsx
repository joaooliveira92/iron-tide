import { Sandbox } from "./sandbox/index.js";

export interface TacticalSandboxScreenProps {
  readonly sessionId: string;
}

export function TacticalSandboxScreen({ sessionId }: TacticalSandboxScreenProps) {
  return (
    <Sandbox.Provider sessionId={sessionId}>
      <Sandbox.Body />
    </Sandbox.Provider>
  );
}
