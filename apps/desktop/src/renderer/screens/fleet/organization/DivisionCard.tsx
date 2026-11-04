import type { DivisionView } from "@bluewave/campaign-engine";
import type { ReactNode } from "react";
import type { DivisionCommandBody } from "../../../../shared/division-contract.js";
import { Card, CardContent } from "../../../components/ui/card.js";
import type { CommandOutcome } from "../../../lib/command-screen-workflow.js";
import { DivisionCardActions } from "./DivisionCardActions.js";
import { DivisionCardProvider } from "./division-card-context.js";
import {
  DivisionCardCommander,
  DivisionCardDoctrine,
  DivisionCardHeader,
  DivisionCardStatus,
} from "./DivisionCardIdentity.js";
import { DivisionCardFleetOrder, DivisionCardFlagship } from "./DivisionCardShips.js";
import type { DivisionOrganizationState } from "./division-organization-state.js";

export interface DivisionCardRootProps {
  readonly division: DivisionView;
  readonly state: DivisionOrganizationState;
  readonly busy: boolean;
  readonly send: (command: DivisionCommandBody) => Promise<CommandOutcome>;
  readonly children: ReactNode;
}

function DivisionCardRoot({ division, state, busy, send, children }: DivisionCardRootProps) {
  return (
    <DivisionCardProvider division={division} organization={state} busy={busy} send={send}>
      <Card>
        <CardContent className="space-y-4 p-4">{children}</CardContent>
      </Card>
    </DivisionCardProvider>
  );
}

export const DivisionCard = {
  Root: DivisionCardRoot,
  Header: DivisionCardHeader,
  Commander: DivisionCardCommander,
  Status: DivisionCardStatus,
  Doctrine: DivisionCardDoctrine,
  Flagship: DivisionCardFlagship,
  FleetOrder: DivisionCardFleetOrder,
  Actions: DivisionCardActions,
};

export type DivisionCardProps = Omit<DivisionCardRootProps, "children">;

export function DefaultDivisionCard(props: DivisionCardProps) {
  return (
    <DivisionCard.Root {...props}>
      <DivisionCard.Header />
      <DivisionCard.Commander />
      <DivisionCard.Status />
      <DivisionCard.Doctrine />
      <DivisionCard.Flagship />
      <DivisionCard.FleetOrder />
      <DivisionCard.Actions />
    </DivisionCard.Root>
  );
}
