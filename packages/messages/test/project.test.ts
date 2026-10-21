import { describe, expect, it } from "vite-plus/test";
import { SafeInt } from "@bluewave/contracts";
import {
  decodeTurnMessage,
  playerVisibleMessages,
  projectTurnMessages,
  TurnMessageSchema,
  type ProjectionInput,
} from "../src/index.js";
import { envelope, snapshot } from "./fixtures.js";

function input(events: ProjectionInput["events"]): ProjectionInput {
  return {
    turnId: "turn-1",
    events,
    snapshot: snapshot(),
    rulesetVersion: "1.2.3",
    contentVersion: "0.5.0",
  };
}

const budget = (delta: number, treasury: number, seq = 1) =>
  envelope(
    {
      kind: "NationBudgetChanged",
      nationId: "uk",
      previousTreasury: SafeInt(treasury - delta),
      newTreasury: SafeInt(treasury),
      delta: SafeInt(delta),
      reason: "appropriation",
    },
    "uk",
    seq,
  );

const constructionProgress = (projectId: string, workAdded: number, seq = 1) =>
  envelope(
    {
      kind: "ConstructionProgressed",
      projectId,
      nationId: "uk",
      previousWork: SafeInt(0),
      newWork: SafeInt(workAdded),
      workAdded: SafeInt(workAdded),
    },
    projectId,
    seq,
  );

describe("TurnMessage projection", () => {
  it("projects a finance event with a category, severity, provenance and an effect", () => {
    const [message] = projectTurnMessages(input([budget(500, 7500)]));
    expect(message).toBeDefined();
    if (message === undefined) return;
    expect(message.category).toBe("FINANCE");
    expect(message.severity).toBe("NORMAL");
    expect(message.turnId).toBe("turn-1");
    expect(message.occurredAt).toBe("1880-02");
    expect(message.phase).toBe("appropriation");
    expect(message.subjectRefs).toContainEqual({ type: "nation", id: "uk" });
    expect(message.effectRefs[0]?.attribute).toBe("treasury");
    expect(message.debugMetadata?.sourceEventIds).toEqual(["NationBudgetChanged-uk-1"]);
    expect(message.debugMetadata?.rulesetVersion).toBe("1.2.3");
    expect(message.debugMetadata?.contentVersion).toBe("0.5.0");
  });

  it("is total over every event kind", () => {
    const bodies = [
      "NationBudgetChanged",
      "ConstructionProgressed",
      "ConstructionDelayed",
      "ShipRebuilt",
      "ConstructionProjectCancelled",
      "ResearchProgressed",
      "BattleInitiated",
      "BattleResolved",
      "TechnologyDiscovered",
    ] as const;
    for (const kind of bodies) {
      expect(() => projectTurnMessages(input([envelope({ kind } as never, "x", 1)]))).not.toThrow();
    }
  });

  it("projects a declined battle as a player-visible battle message carrying the victory-point cost (T-1 04)", () => {
    const [message] = projectTurnMessages(
      input([
        envelope(
          {
            kind: "BattleDeclined",
            nationId: "uk",
            battleId: "battle-1",
            missionType: "FLEET_BATTLE",
            areaId: "a-1",
            victoryPointCost: 5,
            opponentCredit: 0,
            reasonCode: "BATTLE_DECLINED_WITH_CONSEQUENCES",
          },
          "battle-1",
          1,
        ),
      ]),
    );
    expect(message).toMatchObject({
      category: "BATTLE",
      severity: "HIGH",
      phase: "battle_resolution",
      titleKey: "messages.battle.declined.title",
      bodyKey: "messages.battle.declined.body",
      playerVisible: true,
      interpolation: { battleId: "battle-1", areaId: "a-1", victoryPointCost: 5 },
    });
    expect(message?.subjectRefs).toContainEqual({ type: "battle", id: "battle-1" });
    expect(message?.subjectRefs).toContainEqual({ type: "nation", id: "uk" });
  });

  it("projects the repeated-decline threshold as a high-severity player-visible battle message (T-1 05)", () => {
    const [message] = projectTurnMessages(
      input([
        envelope(
          {
            kind: "DeclineThresholdReached",
            nationId: "uk",
            battleId: "battle-2",
            count: 3,
            threshold: 3,
            scope: "WAR",
            rulesetVersion: "1.0.0",
          },
          "battle-2",
          1,
        ),
      ]),
    );
    expect(message).toMatchObject({
      category: "BATTLE",
      severity: "HIGH",
      phase: "battle_resolution",
      titleKey: "messages.battle.declineThreshold.title",
      bodyKey: "messages.battle.declineThreshold.body",
      playerVisible: true,
      interpolation: { nationId: "uk", count: 3, threshold: 3, scope: "WAR" },
    });
    expect(message?.subjectRefs).toContainEqual({ type: "nation", id: "uk" });
  });

  it("projects an enemy withdrawal as a high-severity player-visible message without the draw or enemy force (T-1 07)", () => {
    const [message] = projectTurnMessages(
      input([
        envelope(
          {
            kind: "EnemyDeclinedBattle",
            nationId: "uk",
            enemyNationId: "fr",
            battleId: "battle-3",
            missionType: "FLEET_BATTLE",
            areaId: "a-1",
            enemyVictoryPointCost: 0,
            reasonCode: "ENEMY_DECLINED_BATTLE",
          },
          "battle-3",
          1,
        ),
      ]),
    );
    expect(message).toMatchObject({
      category: "BATTLE",
      severity: "HIGH",
      phase: "battle_generation",
      titleKey: "messages.battle.enemyDeclined.title",
      bodyKey: "messages.battle.enemyDeclined.body",
      playerVisible: true,
      interpolation: { battleId: "battle-3", enemyNationId: "fr", areaId: "a-1" },
    });
    expect(Object.keys(message?.interpolation ?? {})).not.toContain("draw");
    expect(message?.subjectRefs).toContainEqual({ type: "nation", id: "fr" });
  });

  it("projects a prestige change as a high-severity player-visible message naming the source (S-2 04)", () => {
    const [message] = projectTurnMessages(
      input([
        envelope(
          {
            kind: "PrestigeChanged",
            nationId: "uk",
            reasonCode: "UNPAID_FUNDS",
            ruleKind: "PROPORTIONAL_LOSS",
            before: SafeInt(50),
            after: SafeInt(48),
            delta: SafeInt(-2),
            rulesetVersion: "1.0.0",
          },
          "uk",
          1,
        ),
      ]),
    );
    expect(message).toMatchObject({
      phase: "obligation",
      severity: "HIGH",
      titleKey: "messages.prestige.changed.title",
      bodyKey: "messages.prestige.changed.body",
      playerVisible: true,
      interpolation: { nationId: "uk", reasonCode: "UNPAID_FUNDS", before: 50, after: 48 },
    });
    expect(message?.subjectRefs).toContainEqual({ type: "nation", id: "uk" });
  });

  it("reports every declined-battle prestige loss of a month, while other sources keep one message per source (T-1 review)", () => {
    const change = (reasonCode: "DECLINED_BATTLE" | "UNPAID_FUNDS", before: number, seq: number) =>
      envelope(
        {
          kind: "PrestigeChanged",
          nationId: "uk",
          reasonCode,
          ruleKind: "FIXED_LOSS",
          before: SafeInt(before),
          after: SafeInt(before - 2),
          delta: SafeInt(-2),
          rulesetVersion: "1.0.0",
        },
        "uk",
        seq,
      );
    const declined = projectTurnMessages(
      input([change("DECLINED_BATTLE", 50, 1), change("DECLINED_BATTLE", 48, 2)]),
    );
    expect(declined.filter((m) => m.titleKey === "messages.prestige.changed.title")).toHaveLength(
      2,
    );
    const unpaid = projectTurnMessages(
      input([change("UNPAID_FUNDS", 50, 1), change("UNPAID_FUNDS", 48, 2)]),
    );
    expect(unpaid.filter((m) => m.titleKey === "messages.prestige.changed.title")).toHaveLength(1);
  });

  it("aggregates routine construction progress under one aggregate key", () => {
    const messages = projectTurnMessages(
      input([constructionProgress("p1", 10, 1), constructionProgress("p2", 20, 2)]),
    );
    const aggregated = messages.filter((m) => m.aggregateKey === "construction:progress");
    expect(aggregated).toHaveLength(1);
    expect(aggregated[0]?.interpolation["count"]).toBe(2);
    expect(aggregated[0]?.debugMetadata?.sourceEventIds).toEqual([
      "ConstructionProgressed-p1-1",
      "ConstructionProgressed-p2-2",
    ]);
  });

  it("deduplicates messages sharing a deduplication key", () => {
    const delayed = (seq: number) =>
      envelope(
        {
          kind: "ConstructionDelayed",
          projectId: "p1",
          nationId: "uk",
          reason: "PROJECT_DELAYED_ZERO_WORK",
          delayMonth: "1880-02",
        },
        "p1",
        seq,
      );
    const messages = projectTurnMessages(input([delayed(1), delayed(2)]));
    expect(messages.filter((m) => m.deduplicationKey?.includes("delayed"))).toHaveLength(1);
  });

  it("never merges critical outcomes away", () => {
    const breakthrough = (techId: string, seq: number) =>
      envelope(
        {
          kind: "TechnologyDiscovered",
          nationId: "uk",
          techId,
          researchFieldId: "gunnery",
          discoveryMonth: "1880-02",
          cost: SafeInt(100),
        },
        techId,
        seq,
      );
    const messages = projectTurnMessages(input([breakthrough("t1", 1), breakthrough("t2", 2)]));
    expect(messages.filter((m) => m.severity === "CRITICAL")).toHaveLength(2);
  });

  it("excludes TRACE messages from player-visible output", () => {
    const messages = projectTurnMessages(
      input([constructionProgress("p1", 0, 1), budget(0, 100, 2), budget(500, 7500, 3)]),
    );
    expect(messages.some((m) => m.severity === "TRACE")).toBe(true);
    const visible = playerVisibleMessages(messages);
    expect(visible.every((m) => m.severity !== "TRACE")).toBe(true);
  });

  it("is deterministic and canonically ordered", () => {
    const events = [
      budget(500, 7500, 1),
      constructionProgress("p1", 10, 2),
      envelope(
        {
          kind: "TechnologyDiscovered",
          nationId: "uk",
          techId: "t1",
          researchFieldId: "gunnery",
          discoveryMonth: "1880-02",
          cost: SafeInt(100),
        },
        "t1",
        3,
      ),
    ];
    const first = projectTurnMessages(input(events));
    const second = projectTurnMessages(input(events));
    expect(first).toEqual(second);
    expect(first[0]?.category).toBe("CONSTRUCTION");
    expect(first.at(-1)?.category).toBe("RESEARCH");
  });

  it("strict-decodes rejecting excess keys", () => {
    const [message] = projectTurnMessages(input([budget(500, 7500)]));
    expect(message).toBeDefined();
    expect(() => decodeTurnMessage(message)).not.toThrow();
    expect(() => decodeTurnMessage({ ...message, unexpected: true })).toThrow();
    expect(TurnMessageSchema).toBeDefined();
  });
});
