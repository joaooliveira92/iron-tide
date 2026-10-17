import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vite-plus/test";
import type { InterruptionRequestDto } from "../../../shared/campaign-command-contract.js";
import { setUiCatalogue } from "../../content/uiCatalogue.js";
import { BattleRequestDialog } from "./BattleRequestDialog.js";
import { DecisionDialog } from "./DecisionDialog.js";
import { PendingTurnRecoveryPrompt } from "./PendingTurnRecoveryPrompt.js";

beforeAll(() => {
  setUiCatalogue({
    locale: "en-US",
    strings: {
      "messages.decision.title": "Decision required",
      "messages.decision.body": "A decision is needed.",
      "messages.decision.approve.title": "Approve",
      "messages.decision.approve.body": "Spend the funds.",
      "messages.decision.decline.title": "Decline",
      "messages.decision.decline.body": "Keep the funds.",
      "messages.battle.request.title": "Battle awaiting orders",
      "messages.battle.request.body": "A battle awaits.",
      "ui.decision.choose": "Choose",
      "ui.decision.hint": "{target} {attribute}: {direction} ({magnitude})",
      "ui.effect.direction.increase": "increase",
      "ui.effect.direction.decrease": "decrease",
      "ui.effect.direction.none": "no change",
      "ui.effect.magnitude.minor": "minor",
      "ui.effect.magnitude.moderate": "moderate",
      "ui.effect.magnitude.major": "major",
      "ui.battle.accept": "Accept",
      "ui.battle.decline": "Decline",
      "ui.battle.delegate": "Delegate",
      "ui.interruption.abandon": "Abandon this turn",
      "ui.pendingTurn.label": "Outstanding turn",
      "ui.pendingTurn.unavailableTitle": "Outstanding turn cannot be resumed",
      "ui.pendingTurn.unavailableBody": "A saved turn could not be resumed against this campaign.",
      "ui.pendingTurn.title": "A month is outstanding",
      "ui.pendingTurn.body": "This campaign has a turn waiting to be resolved.",
      "ui.pendingTurn.bodyWithDate": "This campaign has a turn waiting (started {createdAt}).",
      "ui.pendingTurn.resume": "Resume turn",
      "ui.pendingTurn.discard": "Discard outstanding turn",
    },
  });
});

afterEach(cleanup);

const decision: InterruptionRequestDto = {
  kind: "decision",
  turnId: "t1",
  interruptionId: "i1",
  ordinal: 0,
  phase: "appropriation",
  titleKey: "messages.decision.title",
  bodyKey: "messages.decision.body",
  interpolation: {},
  decisionId: "dec-1",
  options: [
    {
      optionId: "approve",
      titleKey: "messages.decision.approve.title",
      bodyKey: "messages.decision.approve.body",
      hints: [
        {
          target: { type: "nation", id: "uk" },
          attribute: "treasury",
          direction: "decrease",
          magnitude: "moderate",
        },
      ],
      effects: [{ nationId: "uk", attribute: "treasury", delta: -50 }],
    },
    {
      optionId: "decline",
      titleKey: "messages.decision.decline.title",
      bodyKey: "messages.decision.decline.body",
      hints: [],
      effects: [],
    },
  ],
};

const battle: InterruptionRequestDto = {
  kind: "battle",
  turnId: "t1",
  interruptionId: "i2",
  ordinal: 0,
  phase: "battle_resolution",
  titleKey: "messages.battle.request.title",
  bodyKey: "messages.battle.request.body",
  interpolation: {},
  battleId: "b1",
  attackerId: "uk",
  defenderId: "fr",
  areaId: "a1",
};

describe("turn interruption dialogs", () => {
  it("decision dialog is modal, shows hints, and answers", () => {
    const onAnswer = vi.fn();
    render(<DecisionDialog request={decision} onAnswer={onAnswer} onAbandon={() => undefined} />);
    expect(screen.getByTestId("decision-dialog").getAttribute("aria-modal")).toBe("true");
    expect(screen.getByTestId("decision-hints").textContent).toContain("uk treasury: decrease");
    expect(screen.getAllByTestId("decision-option")[0]!.textContent).toBe("Choose");
    fireEvent.click(screen.getAllByTestId("decision-option")[0]!);
    expect(onAnswer).toHaveBeenCalledWith("approve");
  });

  it("decision dialog can abandon the turn", () => {
    const onAbandon = vi.fn();
    render(<DecisionDialog request={decision} onAnswer={() => undefined} onAbandon={onAbandon} />);
    fireEvent.click(screen.getByTestId("decision-abandon"));
    expect(onAbandon).toHaveBeenCalled();
  });

  it("battle dialog routes accept/decline/delegate", () => {
    const onChoose = vi.fn();
    render(
      <BattleRequestDialog request={battle} onChoose={onChoose} onAbandon={() => undefined} />,
    );
    expect(screen.getByTestId("battle-accept").textContent).toBe("Accept");
    expect(screen.getByTestId("battle-decline").textContent).toBe("Decline");
    expect(screen.getByTestId("battle-delegate").textContent).toBe("Delegate");
    fireEvent.click(screen.getByTestId("battle-accept"));
    fireEvent.click(screen.getByTestId("battle-decline"));
    fireEvent.click(screen.getByTestId("battle-delegate"));
    expect(onChoose.mock.calls.map((call) => call[0])).toEqual(["accept", "decline", "delegate"]);
  });

  it("recovery prompt resumes a pending turn and can discard it", () => {
    const onResume = vi.fn();
    const onAbandon = vi.fn();
    render(
      <PendingTurnRecoveryPrompt
        pending={{
          turnId: "t1",
          campaignId: "c1",
          playerNationId: "uk",
          startingRevision: 0,
          nextInterruptionOrdinal: 0,
          recordedInputCount: 0,
          createdAt: "1880-01",
        }}
        unavailable={false}
        onResume={onResume}
        onAbandon={onAbandon}
      />,
    );
    expect(screen.getByTestId("pending-resume").textContent).toBe("Resume turn");
    expect(screen.getByTestId("pending-abandon").textContent).toBe("Discard outstanding turn");
    fireEvent.click(screen.getByTestId("pending-resume"));
    fireEvent.click(screen.getByTestId("pending-abandon"));
    expect(onResume).toHaveBeenCalled();
    expect(onAbandon).toHaveBeenCalled();
  });

  it("recovery prompt explains an incompatible turn without offering resume", () => {
    render(
      <PendingTurnRecoveryPrompt
        pending={null}
        unavailable
        onResume={() => undefined}
        onAbandon={() => undefined}
      />,
    );
    expect(screen.getByTestId("pending-unavailable")).toBeTruthy();
    expect(screen.queryByTestId("pending-resume")).toBeNull();
  });
});
