/* @vitest-environment jsdom */
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vite-plus/test";
import type { BluewaveDesktopBridge } from "../../preload/index.js";
import type { CampaignCommandClient } from "../../shared/campaign-contract.js";
import type { PlayerProjection } from "@bluewave/campaign-engine";
import { setUiCatalogue } from "../content/uiCatalogue.js";
import { useCampaignShell } from "./useCampaignShell.js";

type CampaignExecute = CampaignCommandClient["execute"];

const projection: PlayerProjection = {
  campaignIdentity: "campaign_1",
  snapshotHash: "hash_abc",
  revision: 3,
  month: { year: 1900, month: 1 },
  playerNationId: "uk",
  nationName: "United Kingdom",
  projectedSurplusDeficit: 1_250_000,
  economy: {
    treasury: 24_500_000,
    monthlyAppropriation: 2_000_000,
    shipyardCapacity: 50,
    constructionSpend: 400_000,
    researchSpend: 350_000,
    maintenanceCost: 250_000,
    obligations: 0,
    researchRequested: 350_000,
    researchCap: 240_000,
    plannedConstruction: 400_000,
    projectedNet: 1_250_000,
    shortfall: 0,
    status: "healthy",
    monthEndTreasury: 25_750_000,
  },
  fleet: [],
  ports: [],
  knownTechnologyIds: [],
  strategicAreas: [],
  knownEnemyNations: [],
  commandWorkspace: { commands: [], movementCommands: [] },
};

const monthResolveSuccess = {
  outcome: "success" as const,
  value: {
    status: "completed" as const,
    summary: {
      turnId: "turn-1",
      projectionVersion: "1.0.0",
      occurredAt: "1900-01",
      rulesetVersion: "0.1.0",
      contentVersion: "0.5.0",
      messages: [],
    },
    closing: {
      revision: 4,
      month: { month: 2, year: 1900 },
      closingTreasury: 22_900_000,
    },
  },
  diagnostics: [],
};

function setup(executeImpl: unknown) {
  const execute = executeImpl as CampaignExecute;
  const bridge = { campaign: { execute } } as unknown as BluewaveDesktopBridge;
  const rendered = renderHook(() => useCampaignShell(bridge));
  return { ...rendered, execute };
}

describe("useCampaignShell", () => {
  it("maps the INC-1 projection fields into the header campaign on open", async () => {
    const execute = vi.fn(async () => ({
      outcome: "success" as const,
      value: { projection },
      diagnostics: [],
    })) as unknown as CampaignExecute;
    const { result } = setup(execute);

    await act(() => result.current.openCampaign("ses-1"));

    expect(execute).toHaveBeenCalledWith("inspectCampaign", "ses-1");
    expect(result.current.campaign).toEqual({
      month: { year: 1900, month: 1 },
      treasury: 24_500_000,
      revision: 3,
      sessionId: "ses-1",
      nationName: "United Kingdom",
      playerNationId: "uk",
      projectedSurplusDeficit: 1_250_000,
      atWar: false,
      activeAlertsCount: null,
    });
  });

  it("reads the campaign views once per open, and once more per refresh", async () => {
    const ok = <T>(value: T) => ({
      outcome: "success" as const,
      value,
      diagnostics: [],
    });
    const execute = vi.fn(async (command: string) =>
      command === "inspectCampaign" ? ok({ projection }) : ok({}),
    );
    const { result } = setup(execute);

    await act(() => result.current.openCampaign("ses-1"));
    await act(() => result.current.refreshCampaign("ses-1"));

    for (const command of [
      "inspectCampaign",
      "inspectMap",
      "readMonthlyReports",
      "inspectPriorities",
    ]) {
      expect(execute.mock.calls.filter(([name]) => name === command)).toHaveLength(2);
    }
    expect(result.current.reads?.projection.status).toBe("ready");
  });

  it("refreshes the header from the engine after a month commit, including war status", async () => {
    const afterCommit: PlayerProjection = {
      ...projection,
      revision: 4,
      month: { year: 1900, month: 2 },
      projectedSurplusDeficit: -56,
      economy: { ...projection.economy, treasury: 22_900_000 },
      knownEnemyNations: ["at"],
    };
    let committed = false;
    const execute = vi.fn(async (command: string) => {
      if (command === "inspectCampaign") {
        return {
          outcome: "success" as const,
          value: { projection: committed ? afterCommit : projection },
          diagnostics: [],
        };
      }
      committed = true;
      return monthResolveSuccess;
    }) as unknown as CampaignExecute;
    const { result } = setup(execute);

    await act(() => result.current.openCampaign("ses-1"));
    expect(result.current.campaign?.atWar).toBe(false);
    await act(() => result.current.advanceMonth());

    expect(execute).toHaveBeenCalledWith(
      "resolveTurn",
      expect.objectContaining({ sessionId: "ses-1", expectedRevision: 3 }),
    );
    expect(result.current.campaign).toEqual({
      month: { year: 1900, month: 2 },
      treasury: 22_900_000,
      revision: 4,
      sessionId: "ses-1",
      nationName: "United Kingdom",
      playerNationId: "uk",
      projectedSurplusDeficit: -56,
      atWar: true,
      activeAlertsCount: null,
    });
    expect(result.current.committing).toBe(false);
  });

  it("refreshCampaign re-reads the header on demand (e.g. after the Simulation screen commits)", async () => {
    let revision = 3;
    const execute = vi.fn(async () => ({
      outcome: "success" as const,
      value: { projection: { ...projection, revision } },
      diagnostics: [],
    })) as unknown as CampaignExecute;
    const { result } = setup(execute);

    await act(() => result.current.openCampaign("ses-1"));
    expect(result.current.campaign?.revision).toBe(3);
    revision = 9;
    await act(() => result.current.refreshCampaign("ses-1"));
    expect(result.current.campaign?.revision).toBe(9);
  });

  it("does not advance while a blocking decision or battle is outstanding", async () => {
    const suspended = {
      outcome: "success" as const,
      value: {
        status: "suspended" as const,
        request: {
          kind: "decision" as const,
          turnId: "t1",
          interruptionId: "i1",
          ordinal: 0,
          phase: "appropriation",
          titleKey: "messages.decision.title",
          bodyKey: "messages.decision.body",
          interpolation: {},
          decisionId: "dec-1",
          options: [],
        },
        pendingTurn: {
          turnId: "t1",
          campaignId: "campaign_1",
          playerNationId: "uk",
          startingRevision: 3,
          nextInterruptionOrdinal: 0,
          recordedInputCount: 0,
          createdAt: "1900-01",
        },
      },
      diagnostics: [],
    };
    const execute = vi.fn(async (command: string) => {
      if (command === "inspectCampaign") {
        return {
          outcome: "success" as const,
          value: { projection },
          diagnostics: [],
        };
      }
      if (command === "readPendingTurn") {
        return {
          outcome: "success" as const,
          value: { pending: null, valid: false },
          diagnostics: [],
        };
      }
      return suspended;
    });
    const { result } = setup(execute);

    await act(() => result.current.openCampaign("ses-1"));
    await act(() => result.current.advanceMonth());
    expect(result.current.interruption?.request?.kind).toBe("decision");

    const resolveCalls = () =>
      execute.mock.calls.filter(([command]) => command === "resolveTurn").length;
    expect(resolveCalls()).toBe(1);
    await act(() => result.current.advanceMonth());
    expect(resolveCalls()).toBe(1);
  });

  const storedPending = {
    turnId: "t1",
    campaignId: "campaign_1",
    playerNationId: "uk",
    startingRevision: 3,
    nextInterruptionOrdinal: 0,
    recordedInputCount: 0,
    createdAt: "1900-01",
  };

  function setupWithPending(valid: boolean) {
    const execute = vi.fn(async (command: string) => {
      if (command === "inspectCampaign") {
        return {
          outcome: "success" as const,
          value: { projection },
          diagnostics: [],
        };
      }
      if (command === "readPendingTurn") {
        return {
          outcome: "success" as const,
          value: { pending: storedPending, valid },
          diagnostics: [],
        };
      }
      return { outcome: "success" as const, value: {}, diagnostics: [] };
    });
    return setup(execute);
  }

  it("marks a stored pending turn unavailable when it fails validation on load (T2)", async () => {
    const { result } = setupWithPending(false);
    await act(async () => {
      await result.current.openCampaign("ses-1");
      await Promise.resolve();
    });
    expect(result.current.interruption?.pending).not.toBeNull();
    expect(result.current.interruption?.unavailable).toBe(true);
  });

  it("offers a stored pending turn for resume when it validates on load (T2)", async () => {
    const { result } = setupWithPending(true);
    await act(async () => {
      await result.current.openCampaign("ses-1");
      await Promise.resolve();
    });
    expect(result.current.interruption?.pending).not.toBeNull();
    expect(result.current.interruption?.unavailable).toBe(false);
  });

  it("shows a result message naming what an answered decision changed", async () => {
    setUiCatalogue({
      locale: "en-US",
      strings: {
        "ui.decision.result": "Decision made: {change}.",
        "ui.decision.result.treasury": "{nationId} treasury {delta}",
        "ui.decision.result.noEffect": "no immediate effect",
      },
    });
    const suspended = {
      outcome: "success" as const,
      value: {
        status: "suspended" as const,
        request: {
          kind: "decision" as const,
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
              titleKey: "messages.decision.title",
              bodyKey: "messages.decision.body",
              hints: [],
              effects: [{ nationId: "uk", attribute: "treasury" as const, delta: -25 }],
            },
          ],
        },
        pendingTurn: {
          turnId: "t1",
          campaignId: "campaign_1",
          playerNationId: "uk",
          startingRevision: 3,
          nextInterruptionOrdinal: 0,
          recordedInputCount: 0,
          createdAt: "1900-01",
        },
      },
      diagnostics: [],
    };
    const execute = vi.fn(async (command: string) => {
      if (command === "inspectCampaign") {
        return {
          outcome: "success" as const,
          value: { projection },
          diagnostics: [],
        };
      }
      if (command === "inspectPriorities") {
        return {
          outcome: "success" as const,
          value: { priorities: [] },
          diagnostics: [],
        };
      }
      if (command === "readPendingTurn") {
        return {
          outcome: "success" as const,
          value: { pending: null, valid: false },
          diagnostics: [],
        };
      }
      if (command === "answerDecision") {
        return monthResolveSuccess;
      }
      return suspended;
    });
    const { result } = setup(execute);

    await act(() => result.current.openCampaign("ses-1"));
    await act(() => result.current.advanceMonth());
    expect(result.current.interruption?.request?.kind).toBe("decision");

    await act(() =>
      result.current.answerInterruption({
        kind: "decision",
        optionId: "approve",
      }),
    );
    expect(result.current.saveMessage).toBe("Decision made: uk treasury -25.");
  });

  describe("a battle offer (T-1 03)", () => {
    const offerRequest = {
      kind: "offer" as const,
      turnId: "t1",
      interruptionId: "i-offer",
      ordinal: 0,
      phase: "battle_resolution",
      titleKey: "messages.offer.request.title",
      bodyKey: "messages.offer.request.body",
      interpolation: { areaId: "a-1" },
      battleId: "battle-1",
      attackerId: "uk",
      defenderId: "france",
      areaId: "a-1",
      missionType: "FLEET_BATTLE",
      acceptanceClass: "OPTIONAL",
      playerSide: "ATTACKER" as const,
      playerForce: [{ shipId: "s1", name: "HMS One", classId: "c1" }],
      estimate: { model: "PERTURBED" as const, strength: 410 },
      supportForcePresent: false,
      declineStatementKeys: [],
    };
    const suspendedAtOffer = {
      outcome: "success" as const,
      value: {
        status: "suspended" as const,
        request: offerRequest,
        pendingTurn: {
          turnId: "t1",
          campaignId: "campaign_1",
          playerNationId: "uk",
          startingRevision: 3,
          nextInterruptionOrdinal: 0,
          recordedInputCount: 0,
          createdAt: "1900-01",
        },
      },
      diagnostics: [],
    };
    const executeWith = (answer: unknown, sent: [string, unknown][] = []) =>
      vi.fn(async (command: string, payload?: unknown) => {
        sent.push([command, payload]);
        if (command === "inspectCampaign") {
          return {
            outcome: "success" as const,
            value: { projection },
            diagnostics: [],
          };
        }
        if (command === "readPendingTurn") {
          return {
            outcome: "success" as const,
            value: { pending: null, valid: false },
            diagnostics: [],
          };
        }
        if (command === "submitOfferResponse") return answer;
        return suspendedAtOffer;
      });

    for (const response of ["accept", "delegate"] as const) {
      it(`answers the offer with a typed ${response} response, never a null/null tie`, async () => {
        const sent: [string, unknown][] = [];
        const { result } = setup(executeWith(monthResolveSuccess, sent));
        await act(() => result.current.openCampaign("ses-1"));
        await act(() => result.current.advanceMonth());
        expect(result.current.interruption?.request?.kind).toBe("offer");

        await act(() =>
          result.current.answerInterruption({
            kind: "offer",
            choice: response,
          }),
        );
        const answers = sent.filter(([command]) => command === "submitOfferResponse");
        expect(answers).toHaveLength(1);
        expect(answers[0]![1]).toMatchObject({
          sessionId: "ses-1",
          expectedRevision: 3,
          interruptionId: "i-offer",
          battleId: "battle-1",
          response,
        });
        expect(sent.some(([command]) => command === "submitBattleResult")).toBe(false);
        expect(result.current.interruption).toBeNull();
        expect(result.current.saveMessage).toBe(
          response === "accept"
            ? "Battle at a-1 accepted and resolved."
            : "Battle at a-1 delegated to staff and resolved.",
        );
      });
    }

    it("answers a decline with a typed decline response and reports its victory-point cost from the turn summary", async () => {
      const sent: [string, unknown][] = [];
      const declinedMessage = {
        bodyKey: "messages.battle.declined.body",
        titleKey: "messages.battle.declined.title",
        interpolation: {
          battleId: "battle-1",
          areaId: "a-1",
          victoryPointCost: 5,
        },
      };
      const answer = {
        ...monthResolveSuccess,
        value: {
          ...monthResolveSuccess.value,
          summary: {
            ...monthResolveSuccess.value.summary,
            messages: [declinedMessage],
          },
        },
      };
      const { result } = setup(executeWith(answer, sent));
      await act(() => result.current.openCampaign("ses-1"));
      await act(() => result.current.advanceMonth());

      await act(() => result.current.answerInterruption({ kind: "offer", choice: "decline" }));
      const answers = sent.filter(([command]) => command === "submitOfferResponse");
      expect(answers).toHaveLength(1);
      expect(answers[0]![1]).toMatchObject({
        interruptionId: "i-offer",
        battleId: "battle-1",
        response: "decline",
      });
      expect(result.current.interruption).toBeNull();
      expect(result.current.saveMessage).toBe("Battle at a-1 declined; 5 victory points lost.");
    });

    it("reports a decline without the figure when the month stays suspended at the next offer", async () => {
      const { result } = setup(
        executeWith({
          ...suspendedAtOffer,
          value: { ...suspendedAtOffer.value },
        }),
      );
      await act(() => result.current.openCampaign("ses-1"));
      await act(() => result.current.advanceMonth());
      await act(() => result.current.answerInterruption({ kind: "offer", choice: "decline" }));
      expect(result.current.saveMessage).toBe("Battle at a-1 declined.");
    });

    it("keeps the offer pending and reports a refused answer", async () => {
      const execute = executeWith({
        outcome: "error" as const,
        reason: "OfferResponseStale",
        diagnostics: ["stale"],
      });
      const { result } = setup(execute);
      await act(() => result.current.openCampaign("ses-1"));
      await act(() => result.current.advanceMonth());
      await act(() => result.current.answerInterruption({ kind: "offer", choice: "accept" }));
      expect(result.current.interruption?.request?.kind).toBe("offer");
      expect(result.current.saveMessage).toContain("OfferResponseStale");
    });
  });

  it("keeps the alert slot empty on a rejected commit and stays ready to retry", async () => {
    const execute = vi.fn(async (command: string) => {
      if (command === "inspectCampaign") {
        return {
          outcome: "success" as const,
          value: { projection },
          diagnostics: [],
        };
      }
      return {
        outcome: "rejected" as const,
        reason: "SIMULATION_END_REACHED",
        diagnostics: [],
      };
    }) as unknown as CampaignExecute;
    const { result } = setup(execute);

    await act(() => result.current.openCampaign("ses-1"));
    await act(() => result.current.advanceMonth());

    expect(result.current.committing).toBe(false);
    expect(result.current.saveMessage).toContain("SIMULATION_END_REACHED");
    expect(result.current.campaign?.activeAlertsCount).toBeNull();
    expect(result.current.campaign?.nationName).toBe("United Kingdom");
  });

  describe("alerts, refresh ordering and the campaign lifecycle", () => {
    const ok = <T>(value: T) => ({
      outcome: "success" as const,
      value,
      diagnostics: [],
    });
    const withMonth = (month: number): PlayerProjection => ({
      ...projection,
      month: { year: 1900, month },
    });
    const priority = (severity: string, id: string) => ({
      id,
      type: "monthly_deficit",
      severity,
      title: "t",
      summary: "s",
      reason: "r",
      destination: "overview",
      fingerprint: id,
    });
    const deferred = <T>() => {
      let resolve!: (value: T) => void;
      const promise = new Promise<T>((r) => {
        resolve = r;
      });
      return { promise, resolve };
    };

    it("shows the engine's real alert count (warnings + criticals) after opening", async () => {
      const execute = vi.fn(async (command: string) =>
        command === "inspectPriorities"
          ? ok({
              priorities: [
                priority("critical", "a"),
                priority("warning", "b"),
                priority("advisory", "c"),
              ],
            })
          : ok({ projection }),
      ) as unknown as CampaignExecute;
      const { result } = setup(execute);
      await act(() => result.current.openCampaign("ses-1"));
      expect(result.current.campaign?.activeAlertsCount).toBe(2);
    });

    it("omits the count (null) when priorities cannot be read, instead of inventing one", async () => {
      const execute = vi.fn(async (command: string) =>
        command === "inspectPriorities"
          ? { outcome: "error" as const, reason: "BOOM", diagnostics: [] }
          : ok({ projection }),
      ) as unknown as CampaignExecute;
      const { result } = setup(execute);
      await act(() => result.current.openCampaign("ses-1"));
      expect(result.current.campaign?.activeAlertsCount).toBeNull();
    });

    it("keeps the NEWER refresh when two overlapping refreshes finish out of order", async () => {
      const slow = deferred<ReturnType<typeof ok>>();
      const fast = deferred<ReturnType<typeof ok>>();
      let inspectCalls = 0;
      const execute = vi.fn(async (command: string) => {
        if (command === "inspectPriorities") return ok({ priorities: [] });
        if (command !== "inspectCampaign") return ok({});
        inspectCalls += 1;
        if (inspectCalls === 1) return ok({ projection: withMonth(1) });
        return inspectCalls === 2 ? slow.promise : fast.promise;
      }) as unknown as CampaignExecute;
      const { result } = setup(execute);
      await act(() => result.current.openCampaign("ses-1"));

      let first!: Promise<void>;
      let second!: Promise<void>;
      act(() => {
        first = result.current.refreshCampaign("ses-1");
        second = result.current.refreshCampaign("ses-1");
      });
      await act(async () => {
        fast.resolve(ok({ projection: withMonth(3) }));
        await second;
      });
      await act(async () => {
        slow.resolve(ok({ projection: withMonth(2) }));
        await first;
      });
      expect(result.current.campaign?.month).toEqual({ year: 1900, month: 3 });
    });

    it("does not re-open a campaign whose refresh finishes after it was closed", async () => {
      const late = deferred<ReturnType<typeof ok>>();
      let inspectCalls = 0;
      const execute = vi.fn(async (command: string) => {
        if (command === "closeCampaign") return ok({ closed: true });
        if (command === "inspectPriorities") return ok({ priorities: [] });
        if (command !== "inspectCampaign") return ok({});
        inspectCalls += 1;
        return inspectCalls === 1 ? ok({ projection }) : late.promise;
      }) as unknown as CampaignExecute;
      const { result } = setup(execute);
      await act(() => result.current.openCampaign("ses-1"));

      let refreshing!: Promise<void>;
      act(() => {
        refreshing = result.current.refreshCampaign("ses-1");
      });
      await act(() => result.current.closeCampaign());
      expect(result.current.campaign).toBeNull();

      await act(async () => {
        late.resolve(ok({ projection: withMonth(2) }));
        await refreshing;
      });
      expect(result.current.campaign).toBeNull();
    });

    it("says why a campaign could not be closed, and keeps it open", async () => {
      const execute = vi.fn(async (command: string) =>
        command === "closeCampaign"
          ? { outcome: "error" as const, reason: "BOOM", diagnostics: [] }
          : command === "inspectPriorities"
            ? ok({ priorities: [] })
            : ok({ projection }),
      ) as unknown as CampaignExecute;
      const { result } = setup(execute);
      await act(() => result.current.openCampaign("ses-1"));
      await act(() => result.current.closeCampaign());
      expect(result.current.saveMessage).toBe("Could not close the campaign: BOOM.");
      expect(result.current.campaign).not.toBeNull();
    });

    it("reports save, copy, cancelled copy and failures in the header message", async () => {
      let save: unknown = ok({ revision: 3 });
      let copy: unknown = ok({ revision: 3, location: "/tmp/copy" });
      const execute = vi.fn(async (command: string) => {
        if (command === "saveCampaign") return save;
        if (command === "copyCampaign") return copy;
        return command === "inspectPriorities" ? ok({ priorities: [] }) : ok({ projection });
      }) as unknown as CampaignExecute;
      const { result } = setup(execute);
      await act(() => result.current.openCampaign("ses-1"));

      await act(() => result.current.saveCampaign());
      expect(result.current.saveMessage).toBe("Campaign saved — revision 3.");

      await act(() => result.current.copyCampaign());
      expect(result.current.saveMessage).toBe("Copy saved to /tmp/copy.");

      copy = {
        outcome: "rejected",
        reason: "SAVE_LOCATION_CANCELLED",
        diagnostics: [],
      };
      await act(() => result.current.copyCampaign());
      expect(result.current.saveMessage).toBeNull();

      copy = {
        outcome: "rejected",
        reason: "COPY_TARGET_NOT_EMPTY",
        diagnostics: ["Pick an empty folder."],
      };
      await act(() => result.current.copyCampaign());
      expect(result.current.saveMessage).toBe(
        "Copy failed: COPY_TARGET_NOT_EMPTY. Pick an empty folder.",
      );

      save = {
        outcome: "error",
        reason: "SAVE_FAILED",
        diagnostics: ["disk full"],
      };
      await act(() => result.current.saveCampaign());
      expect(result.current.saveMessage).toBe("Save failed: SAVE_FAILED. disk full");
    });
  });
});
