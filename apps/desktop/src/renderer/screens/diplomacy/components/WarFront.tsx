import { Anchor, Flag } from "lucide-react";
import { Button } from "../../../components/ui/button.js";
import { cn } from "../../../lib/utils.js";
import { DEBUG_MODE } from "../../../shell/debug-flag.js";
import { WAR_STATUS_LABELS, capitalizeFirst, warScoreSplit } from "../diplomacy-presentation.js";
import type { DiplomacyWarRow } from "../diplomacy-view-model.js";
import { InfoHover } from "./InfoHover.js";
import { NationFlag } from "./NationFlag.js";

export interface WarFrontProps {
  readonly rows: readonly DiplomacyWarRow[];
  readonly busy: boolean;
  readonly onPeaceAction: (warId: string) => void;
}

const STANDING_COPY = {
  ahead: { label: "You are ahead", tone: "text-green-700 dark:text-green-400" },
  behind: { label: "You are behind", tone: "text-destructive" },
  level: { label: "Evenly matched", tone: "text-muted-foreground" },
} as const;

function Combatant({
  name,
  role,
  score,
  flagUrl,
  align,
}: {
  readonly name: string;
  readonly role: string;
  readonly score: number;
  readonly flagUrl: string | null;
  readonly align: "left" | "right";
}) {
  return (
    <div className={cn("flex min-w-0 items-center gap-3", align === "right" && "flex-row-reverse")}>
      <NationFlag
        url={flagUrl}
        name={name}
        className="h-12 w-[4.5rem] rounded border border-border shadow-sm"
      />
      <div className={cn("min-w-0", align === "right" && "text-right")}>
        <p className="truncate text-sm font-medium">{capitalizeFirst(name)}</p>
        <p className="text-xs text-muted-foreground">{role}</p>
        <p className="mt-1 text-3xl font-semibold leading-none tabular-nums">{score}</p>
      </div>
    </div>
  );
}

export function WarFront({ rows, busy, onPeaceAction }: WarFrontProps) {
  if (rows.length === 0) return null;
  return (
    <section aria-label="Wars" className="space-y-3" data-testid="war-front">
      {rows.map((row) => {
        const { war, yourName, enemyName, standing, duration, blockades } = row;
        const split = warScoreSplit(war);
        const active = war.status === "ACTIVE";
        const ended = war.status === "ENDED";
        const standingCopy = STANDING_COPY[standing];
        const youAttack = war.playerSide === "attacker";
        return (
          <article
            key={war.warId}
            className={cn(
              "overflow-hidden rounded-md border",
              ended ? "bg-muted/30" : "border-destructive/40 bg-destructive/[0.04]",
            )}
          >
            <header className="flex flex-wrap items-center justify-between gap-2 px-3 pt-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 text-sm font-semibold",
                    ended ? "text-muted-foreground" : "text-destructive",
                  )}
                >
                  {active && (
                    <span className="relative flex size-2">
                      <span className="absolute inline-flex size-full rounded-full bg-destructive opacity-60 motion-safe:animate-ping" />
                      <span className="relative inline-flex size-2 rounded-full bg-destructive" />
                    </span>
                  )}
                  {WAR_STATUS_LABELS[war.status] ?? war.status}
                </span>
                <span className="text-xs text-muted-foreground">
                  {ended && war.endDate !== undefined
                    ? `${war.startDate} to ${war.endDate}`
                    : `${duration}, since ${war.startDate}`}
                </span>
                {DEBUG_MODE && <span className="font-mono text-xs">{war.warId}</span>}
              </div>
              {active && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => onPeaceAction(war.warId)}
                >
                  <Flag aria-hidden="true" className="size-3.5" />
                  Accept peace
                </Button>
              )}
            </header>

            <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3 px-3 py-3">
              <Combatant
                name={yourName}
                role={youAttack ? "Attacker, you" : "Defender, you"}
                score={split.yours}
                flagUrl={row.yourFlagUrl}
                align="left"
              />
              <p className={cn("pb-0.5 text-xs font-medium", standingCopy.tone)}>
                {ended ? "Final score" : standingCopy.label}
              </p>
              <Combatant
                name={enemyName}
                role={youAttack ? "Defender" : "Attacker"}
                score={split.enemy}
                flagUrl={row.enemyFlagUrl}
                align="right"
              />
            </div>

            <div className="px-3 pb-3">
              <InfoHover
                title="War score"
                rows={[
                  { label: capitalizeFirst(yourName), value: String(split.yours) },
                  { label: capitalizeFirst(enemyName), value: String(split.enemy) },
                  {
                    label: "Margin",
                    value:
                      split.yours === split.enemy
                        ? "Level"
                        : `${split.yours > split.enemy ? "+" : "-"}${Math.abs(split.yours - split.enemy)} for you`,
                  },
                  { label: "Started", value: war.startDate },
                  {
                    label: ended ? "Ended" : "Running for",
                    value: ended && war.endDate !== undefined ? war.endDate : duration,
                  },
                ]}
              >
                <div
                  role="img"
                  aria-label={`War score: ${yourName} ${split.yours}, ${enemyName} ${split.enemy}`}
                  data-testid="war-score-bar"
                  className="relative flex h-3 overflow-hidden rounded-full bg-destructive/70"
                >
                  <div
                    className="h-full bg-primary transition-[width] duration-700 ease-out motion-reduce:transition-none"
                    style={{ width: `${Math.round(split.yourShare * 100)}%` }}
                  />
                  <span className="absolute inset-y-0 left-1/2 w-px bg-background/90" />
                </div>
              </InfoHover>
              {blockades.length > 0 && (
                <ul aria-label="Blockades in this war" className="mt-3 flex flex-wrap gap-2">
                  {blockades.map((blockade) => (
                    <li key={blockade.key}>
                      <InfoHover
                        title={`Blockade of ${blockade.areaLabel}`}
                        rows={[
                          { label: "Blockader", value: capitalizeFirst(blockade.blockaderName) },
                          { label: "Blockaded", value: capitalizeFirst(blockade.blockadedName) },
                          { label: "Since", value: blockade.establishedMonth },
                        ]}
                      >
                        <span className="inline-flex cursor-default items-center gap-1.5 rounded-md border bg-background px-2 py-1 text-xs">
                          <Anchor aria-hidden="true" className="size-3 text-muted-foreground" />
                          <span className="font-medium">{blockade.areaLabel}</span>
                          <span className="text-muted-foreground">
                            since {blockade.establishedMonth}
                          </span>
                        </span>
                      </InfoHover>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </article>
        );
      })}
    </section>
  );
}
