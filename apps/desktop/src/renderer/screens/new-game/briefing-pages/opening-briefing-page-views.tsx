import type { ReactNode } from "react";
import type { OpeningBriefingProjection } from "@bluewave/campaign-engine";
import type { OpeningBriefingPageId } from "../new-game-briefing-screen-state.js";
import { WorldSituationBriefing } from "../world-situation/WorldSituationBriefing.js";
import { AppointmentPage } from "./AppointmentPage.js";
import { ImmediateConcernsPage } from "./ImmediateConcernsPage.js";
import { StateOfTheNavyPage } from "./StateOfTheNavyPage.js";
import { TreasuryPage } from "./TreasuryPage.js";

export interface OpeningBriefingPageViewProps {
  readonly projection: OpeningBriefingProjection;
}

export const OPENING_BRIEFING_PAGE_VIEWS: Readonly<
  Record<OpeningBriefingPageId, (props: OpeningBriefingPageViewProps) => ReactNode>
> = {
  appointment: AppointmentPage,
  state_of_the_navy: StateOfTheNavyPage,
  treasury_position: TreasuryPage,
  foreign_intelligence: WorldSituationBriefing,
  immediate_concerns: ImmediateConcernsPage,
};
