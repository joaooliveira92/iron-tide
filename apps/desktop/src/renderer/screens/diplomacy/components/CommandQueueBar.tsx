import { Handshake, X } from "lucide-react";
import type { DiplomacyScreenProjection } from "../../../../shared/diplomacy-contract.js";
import { Button } from "../../../components/ui/button.js";
import { CardContent, CardHeader, CardTitle } from "../../../components/ui/card.js";
import { GlassCard } from "../../../components/ui/glass-card.js";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select.js";
import { DEBUG_MODE } from "../../../shell/debug-flag.js";
import type { DiplomacyDraftCommand } from "../diplomacy-screen-state.js";

export interface CommandQueueBarProps {
  readonly busy: boolean;
  readonly areas: DiplomacyScreenProjection["areas"];
  readonly draft: DiplomacyDraftCommand | null;
  readonly draftLabel: string | null;
  readonly canSubmit: boolean;
  readonly onAreaChange: (areaId: string) => void;
  readonly onClear: () => void;
  readonly onApply: () => void;
}

export function CommandQueueBar({
  busy,
  areas,
  draft,
  draftLabel,
  canSubmit,
  onAreaChange,
  onClear,
  onApply,
}: CommandQueueBarProps) {
  const declaringWar = draft?.kind === "DeclareWar";
  return (
    // Pinned to the bottom of the viewport so a drafted action is visible the
    // moment it is created, however far down the relations list it was clicked.
    // The sticky element must be this plain wrapper: GlassCard nests its own
    // overflow-hidden container, which would confine `sticky` to the card.
    <div className="sticky bottom-4 z-10 rounded-xl bg-background shadow-lg">
      <GlassCard glassVariant="liquid-refract">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-1.5 text-sm font-medium">
            <Handshake className="h-4 w-4 text-muted-foreground" />
            Command queue
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {draft === null ? (
            <p className="text-sm text-muted-foreground">
              No command selected. Pick an action on a relation row or accept peace on an active
              war.
            </p>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border px-3 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm">{draftLabel}</span>
                {draft.kind === "DeclareBlockade" && (
                  <Select
                    value={draft.areaId}
                    onValueChange={(areaId) => onAreaChange(areaId)}
                    disabled={busy}
                    className="w-52"
                  >
                    <SelectTrigger aria-label="Blockade area">
                      <SelectValue placeholder="Area" />
                    </SelectTrigger>
                    <SelectContent>
                      {areas.map((area) => (
                        <SelectItem key={area.areaId} value={area.areaId}>
                          {DEBUG_MODE ? `${area.name} (${area.areaId})` : area.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <Button variant="ghost" size="sm" disabled={busy} onClick={onClear}>
                  <X className="h-3.5 w-3.5" />
                  Clear
                </Button>
                <Button
                  size="sm"
                  variant={declaringWar ? "destructive" : "default"}
                  disabled={!canSubmit || busy}
                  onClick={onApply}
                >
                  {busy ? "Submitting…" : declaringWar ? "Declare war" : "Submit command"}
                </Button>
              </div>
            </div>
          )}
          {declaringWar && (
            <p role="alert" className="text-sm font-medium text-destructive">
              Once submitted, a declaration of war cannot be cancelled from this screen. It takes
              effect when you advance the month.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Queued commands are applied by the engine on the <strong>next turn advance</strong> —
            the engine remains the only writer of relations, wars and blockades.
          </p>
        </CardContent>
      </GlassCard>
    </div>
  );
}
