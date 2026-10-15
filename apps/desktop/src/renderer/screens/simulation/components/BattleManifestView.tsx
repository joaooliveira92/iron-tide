import type { BattleManifest, BattleSide } from "@bluewave/campaign-engine";

import { Badge } from "../../../components/ui/badge.js";
import { nationDisplayName } from "../../../content/nationDisplayName.js";

interface BattleManifestViewProps {
  readonly manifest: BattleManifest;
  readonly playerNationId: string | null;
}

/** `(Player)`/`(AI)` from the player nation id; omitted entirely when it is unknown. */
function roleSuffix(nationId: string, playerNationId: string | null): string {
  if (playerNationId === null) return "";
  return nationId === playerNationId ? " (Player)" : " (AI)";
}

/**
 * The side for a given role, keyed off `sideId` so the columns cannot silently
 * swap if the manifest ever reorders its sides. Falls back to the historical
 * positional order when a side does not carry the expected id.
 */
function sideFor(
  sides: readonly BattleSide[],
  sideId: "attacker" | "defender",
): BattleSide | undefined {
  return sides.find((side) => side.sideId === sideId) ?? sides[sideId === "attacker" ? 0 : 1];
}

function BattleSideColumn({
  label,
  side,
  playerNationId,
}: {
  readonly label: string;
  readonly side: BattleSide | undefined;
  readonly playerNationId: string | null;
}) {
  const nationId = side?.nationId ?? "";
  return (
    <div>
      <div className="text-[12px] text-muted-foreground">{label}</div>
      <div className="font-semibold text-foreground">
        {side === undefined
          ? ""
          : `${nationDisplayName(nationId)}${roleSuffix(nationId, playerNationId)}`}
      </div>
      <div className="mt-1 text-[12px] text-muted-foreground">SQUADRONS:</div>
      {side?.participants.map((p, idx) => (
        <div key={idx} className="text-[12px]">
          • {p.shipId} ({p.divisionId})
        </div>
      ))}
    </div>
  );
}

export function BattleManifestView({ manifest, playerNationId }: BattleManifestViewProps) {
  return (
    <div className="space-y-2 rounded-md border bg-muted/10 p-3 font-mono text-xs">
      <div className="flex items-center justify-between border-b pb-1">
        <span className="font-semibold text-foreground">BATTLE: {manifest.battleId}</span>
        <Badge variant="outline" className="font-mono text-[12px]">
          {manifest.missionType}
        </Badge>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <BattleSideColumn
          label="ATTACKER"
          side={sideFor(manifest.sides, "attacker")}
          playerNationId={playerNationId}
        />
        <BattleSideColumn
          label="DEFENDER"
          side={sideFor(manifest.sides, "defender")}
          playerNationId={playerNationId}
        />
      </div>
    </div>
  );
}
