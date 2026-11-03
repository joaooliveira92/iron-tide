import type { CombatLogEntry } from "./tactical-log.js";
import { translate } from "../../../lib/strings.js";
import { formatTacticalClock } from "./tactical-time.js";

const CATEGORY_MARK: Record<CombatLogEntry["category"], string> = {
  battle: "■",
  contact: "◇",
  fire: "◆",
  damage: "▼",
};

export function CombatLogPanel({
  entries,
  onSelectShip,
}: {
  readonly entries: readonly CombatLogEntry[];
  readonly onSelectShip: (shipId: string) => void;
}) {
  if (entries.length === 0) {
    return <p className="text-xs text-muted-foreground">{translate("tactical.log.empty")}</p>;
  }
  return (
    <ol data-testid="battle-log" className="space-y-0.5 font-mono text-xs">
      {entries.map((entry) => {
        const subject = entry.targetShipId ?? entry.actorShipId;
        return (
          <li
            key={entry.sequence}
            data-testid="battle-log-entry"
            data-category={entry.category}
            data-sequence={entry.sequence}
            className="flex gap-2"
          >
            <span className="shrink-0 text-muted-foreground">
              {formatTacticalClock(entry.minute)}
            </span>
            <span aria-hidden="true">{CATEGORY_MARK[entry.category]}</span>
            {subject === null ? (
              <span>{translate(entry.messageKey, entry.params)}</span>
            ) : (
              <button
                type="button"
                className="text-left hover:underline"
                onClick={() => onSelectShip(subject)}
              >
                {translate(entry.messageKey, entry.params)}
              </button>
            )}
          </li>
        );
      })}
    </ol>
  );
}
