import { useRef } from "react";

import type { InterruptionRequestDto } from "../../../shared/campaign-command-contract.js";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../components/ui/alert-dialog.js";
import { Button } from "../../components/ui/button.js";
import { offerText } from "./offer-text.js";

/** The answers a battle offer accepts: fight it, let staff fight it, or decline it (which costs victory points). */
export type OfferChoice = "accept" | "delegate" | "decline";

/** The acceptance class whose battles cannot be declined (the engine refuses the answer with a typed reason). */
const UNAVOIDABLE_CLASS = "OPERATIONALLY_UNAVOIDABLE";

/**
 * The battle-offer modal (T-1 03, spec #109 R14). It shows the mission and acceptance class, the area, the two sides, the
 * player's own selected force, the enemy-strength estimate (worded as an estimate, never the true strength) and whether a
 * friendly support force is present, all as text with no colour-only meaning. It is a labelled, described, modal alert
 * dialog: focus moves into it and stays inside, and Escape does not dismiss it, because a missing answer holds the month
 * and is never defaulted. It owns no authoritative state; choosing reports back to the shell, which records the answer.
 * Every string resolves through the UI catalogue.
 */
export function OfferDialog({
  request,
  onChoose,
  onAbandon,
}: {
  readonly request: InterruptionRequestDto;
  readonly onChoose: (choice: OfferChoice) => void;
  readonly onAbandon: () => void;
}) {
  const acceptRef = useRef<HTMLButtonElement>(null);
  const interpolation = request.interpolation;
  const mission = request.missionType ?? "";
  const acceptanceClass = request.acceptanceClass ?? "";
  const estimate = request.estimate;
  const declineRefused = acceptanceClass === UNAVOIDABLE_CLASS;
  const rows: readonly (readonly [string, string])[] = [
    [offerText("ui.offer.field.mission"), offerText(`ui.offer.mission.${mission}`)],
    [offerText("ui.offer.field.class"), offerText(`ui.offer.class.${acceptanceClass}`)],
    [offerText("ui.offer.field.area"), request.areaId ?? ""],
    [
      offerText("ui.offer.field.sides"),
      offerText("ui.offer.sides.value", {
        attackerId: request.attackerId ?? "",
        defenderId: request.defenderId ?? "",
      }),
    ],
    [
      offerText("ui.offer.field.yourSide"),
      offerText(`ui.offer.side.${request.playerSide ?? "ATTACKER"}`),
    ],
  ];
  return (
    <AlertDialog open onOpenChange={() => undefined}>
      <AlertDialogContent
        data-testid="offer-dialog"
        aria-modal="true"
        initialFocus={acceptRef}
        className="max-w-md gap-3 p-4"
      >
        <AlertDialogHeader className="space-y-1">
          <AlertDialogTitle className="text-sm">
            {offerText(request.titleKey, interpolation)}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-xs">
            {offerText(request.bodyKey, interpolation)}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
          {rows.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-muted-foreground">{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        <section aria-labelledby="offer-force-heading">
          <h3 id="offer-force-heading" className="text-xs font-semibold">
            {offerText("ui.offer.force.heading")}
          </h3>
          <ul className="mt-1 space-y-0.5 text-xs" data-testid="offer-force">
            {(request.playerForce ?? []).map((ship) => (
              <li key={ship.shipId}>
                {offerText("ui.offer.force.ship", { name: ship.name, classId: ship.classId })}
              </li>
            ))}
          </ul>
        </section>
        {estimate !== undefined && (
          <p className="text-xs font-medium" data-testid="offer-estimate">
            {offerText(`ui.offer.estimate.${estimate.model}`, { strength: estimate.strength })}
          </p>
        )}
        <p className="text-xs" data-testid="offer-support">
          {offerText(
            request.supportForcePresent === true
              ? "ui.offer.support.present"
              : "ui.offer.support.absent",
          )}
        </p>
        <AlertDialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
          <Button
            ref={acceptRef}
            type="button"
            size="sm"
            data-testid="offer-accept"
            onClick={() => onChoose("accept")}
          >
            {offerText("ui.offer.accept")}
          </Button>
          <p className="text-xs text-muted-foreground">{offerText("ui.offer.accept.hint")}</p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            data-testid="offer-delegate"
            onClick={() => onChoose("delegate")}
          >
            {offerText("ui.offer.delegate")}
          </Button>
          <p className="text-xs text-muted-foreground">{offerText("ui.offer.delegate.hint")}</p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            data-testid="offer-decline"
            aria-disabled={declineRefused}
            aria-describedby="offer-decline-statement"
            onClick={() => {
              if (!declineRefused) onChoose("decline");
            }}
          >
            {offerText("ui.offer.decline")}
          </Button>
          <div id="offer-decline-statement" className="text-xs text-muted-foreground">
            {declineRefused ? (
              <p data-testid="offer-decline-reason">{offerText("ui.offer.decline.unavoidable")}</p>
            ) : null}
            {(request.declineStatementKeys ?? []).map((key) => (
              <p key={key}>{offerText(key)}</p>
            ))}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            data-testid="offer-abandon"
            onClick={onAbandon}
          >
            {offerText("ui.offer.abandon")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
