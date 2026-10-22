import { cn } from "../../../lib/utils.js";
import { formatCampaignMonth } from "../../../shell/site-header-state.js";
import { formatList, outlookLabel, statusLabel, worldText } from "../world-situation-copy.js";
import { OUTLOOK_TONE } from "../world-situation-presentation.js";
import { POWER_OUTLOOKS, RELATION_KINDS, type WorldSituation } from "../world-situation.js";
import { GlassCard } from "../../../components/ui/glass-card.js";
import { NationGlyph } from "./NationGlyph.js";

function PostureFigure({
  label,
  count,
  className,
}: {
  readonly label: string;
  readonly count: number;
  readonly className?: string;
}) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dd className={cn("text-base font-semibold tabular-nums", className)}>{count}</dd>
      <dt className="text-xs text-muted-foreground">{label}</dt>
    </div>
  );
}

function TheaterList({ entries }: { readonly entries: WorldSituation["theaterBoard"] }) {
  return (
    <ul className="flex flex-col gap-1">
      {entries.map((entry) => (
        <li
          key={entry.theater.id}
          className={cn(
            "border-l-2 pl-2 text-sm",
            entry.isPlayerTheater
              ? "border-l-primary text-foreground"
              : "border-l-border text-muted-foreground",
          )}
        >
          <span className="font-semibold">{entry.theater.label}</span>
          {entry.isPlayerTheater && (
            <span className="ml-1.5 text-xs font-bold tracking-wide text-muted-foreground uppercase">
              {worldText("world.board.yours")}
            </span>
          )}
          {entry.powers.length > 0 && (
            <span className="block text-xs">
              {worldText("world.board.powersIn")}:{" "}
              {formatList(entry.powers.map((power) => power.name))}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

export function StrategicSituationSummary({ situation }: { readonly situation: WorldSituation }) {
  const { player, posture } = situation;
  const standing = RELATION_KINDS.filter((kind) => posture.byStatus[kind] > 0);
  return (
    <GlassCard glassVariant="liquid-refract">
      <section aria-labelledby="world-title" className="flex flex-col gap-4 p-4">
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {worldText("world.eyebrow")} · {formatCampaignMonth(situation.month)}
          </p>
          <h2 id="world-title" className="text-xl font-semibold">
            {worldText("world.title")}
          </h2>
          <div className="flex items-center gap-3">
            <NationGlyph nationId={player.nationId} name={player.name} />
            <p className="text-sm font-medium">
              {player.name}
              <span className="ml-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {worldText("world.activeNation")}
              </span>
            </p>
          </div>
          <h3 className="sr-only">{worldText("world.assessment.heading")}</h3>
          <p className="text-sm text-muted-foreground">
            {player.assessment ?? worldText("world.assessment.fallback", { nation: player.name })}
          </p>
          <p className="text-xs text-muted-foreground">{worldText("world.startingNote")}</p>
        </div>

        <div>
          <h3 className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {worldText("world.posture.heading")}
          </h3>
          <dl
            className="flex flex-wrap gap-x-5 gap-y-1"
            aria-label={worldText("world.posture.status")}
          >
            {standing.length === 0 ? (
              <dd className="text-sm text-muted-foreground">
                {worldText("world.posture.noAllies")}
              </dd>
            ) : (
              standing.map((kind) => (
                <PostureFigure
                  key={kind}
                  label={statusLabel(kind)}
                  count={posture.byStatus[kind]}
                />
              ))
            )}
          </dl>
          <dl
            className="mt-1 flex flex-wrap gap-x-5 gap-y-1"
            aria-label={worldText("world.posture.outlook")}
          >
            {POWER_OUTLOOKS.map((outlook) => (
              <PostureFigure
                key={outlook}
                label={outlookLabel(outlook)}
                count={posture.byOutlook[outlook]}
                className={OUTLOOK_TONE[outlook].text}
              />
            ))}
          </dl>
        </div>
      </section>
    </GlassCard>
  );
}

export function TheaterBoard({ situation }: { readonly situation: WorldSituation }) {
  const { player, theaterBoard } = situation;
  const primary = player.theaters[0];
  const otherTheaters = theaterBoard.filter((entry) => !entry.isPlayerTheater);
  return (
    <GlassCard glassVariant="liquid-refract">
      <section aria-labelledby="world-board-heading" className="flex flex-col p-4">
        <div>
          <h2
            id="world-board-heading"
            className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase"
          >
            {worldText("world.board.heading")}
          </h2>
          {primary === undefined ? (
            <p className="text-sm text-muted-foreground">{worldText("world.theater.none")}</p>
          ) : (
            <>
              <TheaterList entries={theaterBoard.filter((entry) => entry.isPlayerTheater)} />
              {otherTheaters.length > 0 && (
                <details className="mt-1.5">
                  <summary className="cursor-pointer rounded-sm text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    {worldText("world.board.others", { count: otherTheaters.length })}
                  </summary>
                  <div className="mt-1.5">
                    <TheaterList entries={otherTheaters} />
                  </div>
                </details>
              )}
            </>
          )}
          <p className="mt-1.5 text-xs text-muted-foreground">{worldText("world.board.caption")}</p>
        </div>
      </section>
    </GlassCard>
  );
}
