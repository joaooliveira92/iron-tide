import type { ReactElement } from "react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "../../../components/ui/hover-card.js";
import { SlateFacts, SlateFoot } from "../../../components/ui/slate.js";
import { humanizeId } from "../../../lib/humanize-id.js";
import { cn } from "../../../lib/utils.js";
import type { BattleRecord } from "../diplomacy-hover.js";
import { TENSION_TONES } from "../diplomacy-presentation.js";
import type { DiplomacyRelationRow } from "../diplomacy-view-model.js";
import { NationFlag } from "./NationFlag.js";
import { TensionGauge } from "./TensionGauge.js";

export interface NationHoverCardProps {
  readonly row: DiplomacyRelationRow;
  readonly record: BattleRecord | undefined;
  readonly side?: "top" | "right" | "bottom" | "left";
  readonly children: ReactElement;
}

function Stat({ label, value }: { readonly label: string; readonly value: number }) {
  return (
    <div className="rounded-md border border-border/50 bg-muted/30 px-2 py-1.5 text-center">
      <p className="text-base font-semibold leading-none tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

export function NationHoverCard({ row, record, side = "right", children }: NationHoverCardProps) {
  const tone = TENSION_TONES[row.band];
  return (
    <HoverCard>
      <HoverCardTrigger delay={150} closeDelay={80} render={children} />
      <HoverCardContent
        side={side}
        align="center"
        sideOffset={10}
        collisionPadding={12}
        className="w-72"
      >
        <div className="relative h-24">
          <NationFlag
            url={row.flagUrl}
            name={row.partnerName}
            className="absolute inset-0 size-full"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
          <div className="absolute inset-x-3 bottom-2.5 flex items-end justify-between gap-2 text-white">
            <p className="text-base font-semibold leading-tight">{row.partnerName}</p>
            <p
              className={cn(
                "shrink-0 rounded px-1.5 py-0.5 text-xs font-medium",
                row.atWar ? "bg-destructive" : "bg-black/50",
              )}
            >
              {row.relationLabel}
            </p>
          </div>
        </div>
        <div className="space-y-3 p-3">
          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between">
              <span className={cn("text-sm font-semibold", tone.text)}>{humanizeId(row.band)}</span>
              <span className="text-xs tabular-nums text-muted-foreground">{row.tension}/10</span>
            </div>
            <TensionGauge tension={row.tension} band={row.band} size="lg" />
          </div>
          <SlateFacts
            rows={[
              { label: "Pact", value: row.nap ? "Non-aggression" : "None" },
              { label: "Stance since", value: row.since },
              {
                label: "Blockades",
                value: row.blockades.length === 0 ? "None" : String(row.blockades.length),
              },
              ...(row.isLikelyRival ? [{ label: "Assessment", value: "Likely rival" }] : []),
            ]}
          />
          {record !== undefined && record.played > 0 ? (
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">Your battles against them</p>
              <div className="grid grid-cols-3 gap-1.5">
                <Stat label="Won" value={record.won} />
                <Stat label="Lost" value={record.lost} />
                <Stat label="Undecided" value={record.undecided} />
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No battles fought against them yet</p>
          )}
        </div>
        <SlateFoot>Select to open the dossier and give orders.</SlateFoot>
      </HoverCardContent>
    </HoverCard>
  );
}
