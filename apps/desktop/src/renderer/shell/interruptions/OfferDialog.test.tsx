import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { InterruptionRequestDto } from "../../../shared/campaign-command-contract.js";
import { OfferDialog } from "./OfferDialog.js";

// T-1 03 (#112, spec #109 R14): the offer dialog. Its strings live in the renderer's en-US catalogue, so the test
// asserts the resolved text, never a raw key.
afterEach(cleanup);

const offer: InterruptionRequestDto = {
  kind: "offer",
  turnId: "t1",
  interruptionId: "i-offer",
  ordinal: 0,
  phase: "battle_resolution",
  titleKey: "messages.offer.request.title",
  bodyKey: "messages.offer.request.body",
  interpolation: { areaId: "a-1", attackerId: "uk", defenderId: "france" },
  battleId: "battle-1",
  attackerId: "uk",
  defenderId: "france",
  areaId: "a-1",
  missionType: "FLEET_BATTLE",
  acceptanceClass: "OPTIONAL",
  playerSide: "ATTACKER",
  playerForce: [
    { shipId: "s1", name: "HMS One", classId: "ironclad" },
    { shipId: "s2", name: "HMS Two", classId: "cruiser" },
  ],
  estimate: { model: "PERTURBED", strength: 410 },
  supportForcePresent: false,
  declineStatementKeys: [],
};

const renderOffer = (request = offer, handlers: { onChoose?: () => void } = {}) =>
  render(
    <OfferDialog
      request={request}
      onChoose={handlers.onChoose ?? (() => undefined)}
      onAbandon={() => undefined}
    />,
  );

describe("OfferDialog", () => {
  it("is a labelled, described, modal alert dialog", () => {
    renderOffer();
    const dialog = screen.getByRole("alertdialog", { name: "Battle offered" });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.getAttribute("aria-describedby")).not.toBeNull();
    expect(dialog.textContent).toContain("A battle is offered at a-1 between uk and france.");
  });

  it("shows the mission, class, area, sides, own force, estimate and support line as text", () => {
    renderOffer();
    const dialog = screen.getByRole("alertdialog");
    for (const text of [
      "Fleet battle",
      "Optional",
      "a-1",
      "uk (attacker) against france (defender)",
      "Attacker",
      "HMS One (ironclad)",
      "HMS Two (cruiser)",
      "Enemy strength: about 410 (an estimate, may be off)",
      "No friendly support force is present.",
    ]) {
      expect(dialog.textContent, text).toContain(text);
    }
    expect(dialog.textContent).not.toMatch(/ui\.offer|messages\.offer/);
  });

  it("words each estimate model and the support force in text, not by colour", () => {
    cleanup();
    renderOffer({
      ...offer,
      estimate: { model: "EXACT", strength: 400 },
      supportForcePresent: true,
    });
    expect(screen.getByRole("alertdialog").textContent).toContain("Enemy strength: 400");
    expect(screen.getByRole("alertdialog").textContent).toContain(
      "A friendly support force is present.",
    );
    cleanup();
    renderOffer({
      ...offer,
      supportForcePresent: true,
      supportNationIds: ["italy", "austria"],
    });
    expect(screen.getByTestId("offer-support").textContent).toBe(
      "A friendly support force from italy, austria is present.",
    );
    cleanup();
    renderOffer({ ...offer, estimate: { model: "BANDED", strength: 450 } });
    expect(screen.getByRole("alertdialog").textContent).toContain(
      "Enemy strength: about 450 (banded estimate)",
    );
  });

  it("offers accept, delegate and decline as named buttons", () => {
    const onChoose = vi.fn();
    renderOffer(offer, { onChoose });
    const dialog = screen.getByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /Accept battle/ }));
    fireEvent.click(within(dialog).getByRole("button", { name: /Delegate to staff/ }));
    fireEvent.click(within(dialog).getByRole("button", { name: /Decline battle/ }));
    expect(onChoose.mock.calls.map((call) => call[0])).toEqual(["accept", "delegate", "decline"]);
  });

  it("states plainly that declining costs victory points and may cost prestige, tied to the decline control", () => {
    renderOffer({
      ...offer,
      declineStatementKeys: [
        "ui.offer.decline.costsVictoryPoints",
        "ui.offer.decline.mayCostPrestige",
      ],
    });
    const decline = screen.getByTestId("offer-decline");
    const statement = document.getElementById(decline.getAttribute("aria-describedby") ?? "");
    expect(statement?.textContent).toContain("Declining a battle costs victory points.");
    expect(statement?.textContent).toContain("Repeated declines may also cost prestige.");
    expect(screen.queryByTestId("offer-decline-reason")).toBeNull();
    expect(decline.getAttribute("aria-disabled")).toBe("false");
  });

  it("refuses to decline an operationally unavoidable battle, with a reason, and stays keyboard reachable", () => {
    const onChoose = vi.fn();
    renderOffer({ ...offer, acceptanceClass: "OPERATIONALLY_UNAVOIDABLE" }, { onChoose });
    const decline = screen.getByTestId("offer-decline");
    expect(decline.getAttribute("aria-disabled")).toBe("true");
    decline.focus();
    expect(document.activeElement).toBe(decline);
    expect(screen.getByTestId("offer-decline-reason").textContent).toBe(
      "This battle is operationally unavoidable, so it cannot be declined.",
    );
    fireEvent.click(decline);
    expect(onChoose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("offer-accept"));
    expect(onChoose).toHaveBeenCalledWith("accept");
  });

  it("moves focus into the dialog and stays open on Escape (a missing answer holds, never defaults)", async () => {
    const onChoose = vi.fn();
    renderOffer(offer, { onChoose });
    const dialog = screen.getByRole("alertdialog");
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
    expect(document.activeElement).toBe(screen.getByTestId("offer-accept"));
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.queryByRole("alertdialog")).not.toBeNull();
    expect(onChoose).not.toHaveBeenCalled();
  });

  it("can abandon the turn", () => {
    const onAbandon = vi.fn();
    render(<OfferDialog request={offer} onChoose={() => undefined} onAbandon={onAbandon} />);
    fireEvent.click(screen.getByRole("button", { name: "Abandon this turn" }));
    expect(onAbandon).toHaveBeenCalled();
  });
});
