import type { DiplomacyPeaceRefusal } from "@bluewave/campaign-engine";
import { capitalizeFirst } from "../diplomacy-presentation.js";

export interface PeaceRefusalNoteProps {
  readonly id: string;
  readonly refusal: DiplomacyPeaceRefusal;
  readonly enemyName: string;
  readonly enemyLead: number;
}

const REASON_COPY: Readonly<Record<string, string>> = {
  PROPOSER_TRAILS_BY_MARGIN: "is winning the war and will refuse peace on the current terms",
};

export function PeaceRefusalNote({ id, refusal, enemyName, enemyLead }: PeaceRefusalNoteProps) {
  const name = capitalizeFirst(enemyName);
  return (
    <p
      id={id}
      data-testid="peace-refusal-note"
      className="mx-3 mt-3 rounded-md border border-destructive/40 bg-background px-3 py-2 text-xs text-muted-foreground"
    >
      {name} {REASON_COPY[refusal.reasonCode] ?? "will refuse peace on the current terms"}. It leads
      by {enemyLead} and refuses while that lead is {refusal.margin} or more.
    </p>
  );
}
