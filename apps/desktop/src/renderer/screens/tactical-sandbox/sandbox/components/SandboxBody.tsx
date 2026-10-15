import { Crosshair } from "lucide-react";
import { PageHeader } from "../../../../components/shared/PageHeader.js";
import { SandboxEventLedger } from "./SandboxEventLedger.js";
import { SandboxOutcomeCard } from "./SandboxOutcomeCard.js";
import { SandboxResolveCard } from "./SandboxResolveCard.js";
import { SandboxSetupCard } from "./SandboxSetupCard.js";

export function SandboxBody() {
  return (
    <div className="space-y-6">
      <PageHeader
        icon={Crosshair}
        title="Tactical Sandbox"
        description="Generate a battle from an active war and drive it through the Milestone 2/3 tactical resolver — gunnery, torpedoes, mines, submarines, coastal defenses, smoke, and damage control all report through the same outcome the campaign uses."
      />
      <SandboxSetupCard />
      <SandboxResolveCard />
      <SandboxOutcomeCard />
      <SandboxEventLedger />
    </div>
  );
}
