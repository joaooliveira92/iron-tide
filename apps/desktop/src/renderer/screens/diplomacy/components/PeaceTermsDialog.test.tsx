/* @vitest-environment jsdom */
import {
  buildPeaceOffer,
  type DiplomacyPeaceOffer,
  type DiplomacyPeaceTermRef,
} from "@bluewave/campaign-engine";
import type { NationState, WarDeclaration } from "@bluewave/campaign";
import type { PeaceCheckSnapshot } from "@bluewave/commands";
import { SafeInt } from "@bluewave/contracts";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { PeaceTermsDialog } from "./PeaceTermsDialog.js";

const war: WarDeclaration = {
  id: "war_uk_fra",
  attackerSideId: "side_uk",
  defenderSideId: "side_fra",
  attackerSideMembers: ["uk"],
  defenderSideMembers: ["fra"],
  attackerWarScore: 5,
  defenderWarScore: 1,
  attackerId: "uk",
  defenderId: "fra",
  startDate: "1880-01",
  status: "ACTIVE",
};

const snapshot: PeaceCheckSnapshot = {
  wars: {
    wars: [war],
    battles: [],
    participantMemberships: [],
    blockadeState: [],
    battleManifests: [],
  },
  world: {
    areas: [
      {
        id: "fra_home",
        name: "France",
        type: "coastal",
        controller: "fra",
        cessionCost: SafeInt(2),
      },
      {
        id: "med_corsica",
        name: "Corsica",
        type: "coastal",
        controller: "fra",
        cessionCost: SafeInt(4),
      },
      {
        id: "med_malta",
        name: "Malta",
        type: "coastal",
        controller: "fra",
        cessionCost: SafeInt(9),
      },
      {
        id: "med_tunis",
        name: "Tunis",
        type: "coastal",
        controller: "fra",
        cessionCost: SafeInt(3),
      },
    ],
    routes: [],
    ports: [],
    possessions: [],
  },
  nations: new Map([["fra", { homeAreaId: "fra_home" } as NationState]]),
};

function offerOf(): DiplomacyPeaceOffer {
  const offer = buildPeaceOffer(snapshot, war, "uk");
  if (offer === undefined) throw new Error("expected an offer");
  return offer;
}

function Harness({ onConfirm }: { readonly onConfirm: (term: DiplomacyPeaceTermRef) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Peace terms
      </button>
      <PeaceTermsDialog
        open={open}
        onOpenChange={setOpen}
        enemyName="France"
        offer={offerOf()}
        onConfirm={onConfirm}
      />
    </>
  );
}

function openDialog(onConfirm: (term: DiplomacyPeaceTermRef) => void = () => undefined) {
  render(<Harness onConfirm={onConfirm} />);
  const trigger = screen.getByRole("button", { name: "Peace terms" });
  trigger.focus();
  fireEvent.click(trigger);
  return trigger;
}

afterEach(cleanup);

describe("PeaceTermsDialog", () => {
  it("shows the budget, each cost and what is left, all equal to their explanation trees", async () => {
    openDialog();
    const dialog = await screen.findByRole("dialog");
    const offer = offerOf();
    expect(within(dialog).getByTestId("peace-budget").textContent).toBe(
      String(offer.budgetExplanation.result),
    );
    for (const term of offer.terms) {
      const key = term.term._tag === "CedeArea" ? `CedeArea:${term.term.areaId}` : "StatusQuo";
      expect(within(dialog).getByTestId(`peace-term-cost-${key}`).textContent).toBe(
        `Cost ${term.costExplanation.result}`,
      );
      expect(within(dialog).getByTestId(`peace-term-left-${key}`).textContent).toBe(
        `Left ${term.remainingExplanation.result}`,
      );
      expect(within(dialog).getByTestId(`peace-cost-explanation-${key}`)).toBeTruthy();
      expect(within(dialog).getByTestId(`peace-remaining-explanation-${key}`)).toBeTruthy();
    }
    expect(within(dialog).getByTestId("peace-budget-explanation")).toBeTruthy();
  });

  it("traces a cession price to the area content and marks it provisional", async () => {
    openDialog();
    const dialog = await screen.findByRole("dialog");
    const cost = within(dialog).getByTestId("peace-cost-explanation-CedeArea:med_corsica");
    expect(cost.textContent).toContain("Area price (provisional balance value)");
    const option = within(dialog).getByTestId("peace-term-CedeArea:med_corsica");
    expect(within(option).getByText("Provisional")).toBeTruthy();
    const status = within(dialog).getByTestId("peace-term-StatusQuo");
    expect(within(status).queryByText("Provisional")).toBeNull();
  });

  it("moves focus into the dialog on open and back to the trigger on Escape", async () => {
    const trigger = openDialog();
    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
    fireEvent.keyDown(document.activeElement ?? dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it("labels the dialog with its title and description", async () => {
    openDialog();
    const dialog = await screen.findByRole("dialog", { name: /Peace terms with France/ });
    expect(dialog.getAttribute("aria-describedby")).not.toBeNull();
  });

  it("disables a term the war score cannot pay for and says why", async () => {
    openDialog();
    const dialog = await screen.findByRole("dialog");
    const malta = within(dialog).getByRole("radio", { name: /France cedes Malta/ });
    expect(malta.getAttribute("aria-disabled") === "true" || malta.hasAttribute("disabled")).toBe(
      true,
    );
    expect(within(dialog).getByText("Costs 4 more war score than you have.")).toBeTruthy();
    const queue = within(dialog).getByRole("button", { name: "Queue peace terms" });
    fireEvent.click(malta);
    expect(queue.hasAttribute("disabled") || queue.getAttribute("aria-disabled") === "true").toBe(
      false,
    );
  });

  it("selects with the arrow keys and skips the term that cannot be afforded", async () => {
    openDialog();
    const dialog = await screen.findByRole("dialog");
    const radios = within(dialog).getAllByRole("radio");
    const statusQuo = radios[0]!;
    statusQuo.focus();
    expect(statusQuo.getAttribute("aria-checked")).toBe("true");
    fireEvent.keyDown(statusQuo, { key: "ArrowDown" });
    const corsica = within(dialog).getByRole("radio", { name: /France cedes Corsica/ });
    await waitFor(() => expect(corsica.getAttribute("aria-checked")).toBe("true"));
    fireEvent.keyDown(corsica, { key: "ArrowDown" });
    const tunis = within(dialog).getByRole("radio", { name: /France cedes Tunis/ });
    await waitFor(() => expect(tunis.getAttribute("aria-checked")).toBe("true"));
    fireEvent.keyDown(tunis, { key: "ArrowDown" });
    await waitFor(() => expect(statusQuo.getAttribute("aria-checked")).toBe("true"));
  });

  it("confirms the status quo by default with the exact term", async () => {
    const onConfirm = vi.fn();
    openDialog(onConfirm);
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Queue peace terms" }));
    expect(onConfirm).toHaveBeenCalledWith({ _tag: "StatusQuo" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("confirms a chosen cession with its area id", async () => {
    const onConfirm = vi.fn();
    openDialog(onConfirm);
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("radio", { name: /France cedes Corsica/ }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Queue peace terms" }));
    expect(onConfirm).toHaveBeenCalledWith({ _tag: "CedeArea", areaId: "med_corsica" });
  });

  it("cancels without confirming", async () => {
    const onConfirm = vi.fn();
    openDialog(onConfirm);
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(onConfirm).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("explains an empty cession list instead of leaving the status quo alone", async () => {
    const bare: PeaceCheckSnapshot = {
      ...snapshot,
      world: { ...snapshot.world, areas: [] },
    };
    const offer = buildPeaceOffer(bare, war, "uk")!;
    render(
      <PeaceTermsDialog
        open
        onOpenChange={() => undefined}
        enemyName="France"
        offer={offer}
        onConfirm={() => undefined}
      />,
    );
    expect(await screen.findByTestId("peace-no-cessions")).toBeTruthy();
  });
});
