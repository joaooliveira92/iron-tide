import { warScoreSplit } from "../diplomacy-presentation.js";

export interface WarScoreBarProps {
  readonly war: Parameters<typeof warScoreSplit>[0];
  readonly yourName: string;
  readonly enemyName: string;
}

export function WarScoreBar({ war, yourName, enemyName }: WarScoreBarProps) {
  const { yours, enemy, yourShare } = warScoreSplit(war);
  return (
    <div className="w-full space-y-1" data-testid="war-score-bar">
      <div className="flex items-baseline justify-between text-xs">
        <span className="font-medium">
          {yourName} <span className="tabular-nums">{yours}</span>
        </span>
        <span className="text-muted-foreground">War score</span>
        <span className="font-medium">
          <span className="tabular-nums">{enemy}</span> {enemyName}
        </span>
      </div>
      <div
        role="img"
        aria-label={`War score: ${yourName} ${yours}, ${enemyName} ${enemy}`}
        className="flex h-2 overflow-hidden rounded-full bg-destructive/60"
      >
        <div className="h-full bg-primary" style={{ width: `${Math.round(yourShare * 100)}%` }} />
      </div>
    </div>
  );
}
