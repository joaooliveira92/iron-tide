import type { PlayerBattleShipView, PlayerBattleView } from "@bluewave/combat/battleResolution";
import { describe, expect, it } from "vite-plus/test";
import { projectCombatLog, shipIdOf, transientMarkers } from "./tactical-log.js";

const ship = (shipId: string, sideId: string): PlayerBattleShipView => ({
  shipId,
  name: `Ship ${shipId}`,
  className: "c",
  shipType: "ironclad",
  sideId,
  divisionId: null,
  hitPoints: 10,
  maxHitPoints: 10,
  damageState: "NORMAL",
  position: [0, 0],
  headingDeg: 0,
  speedBp: 0,
  contactConfidenceBp: null,
});

const BASE: PlayerBattleView = {
  battleId: "bat",
  campaignMonth: "1880-02",
  playerNationId: "uk",
  areaId: "channel",
  attackerId: "uk",
  defenderId: "fr",
  minute: 3,
  maxMinutes: 100,
  ended: false,
  endReason: null,
  winnerId: null,
  loserId: null,
  objectives: [],
  weather: { seaState: "CALM", visibilityNm: 10, precipitation: "CLEAR", daylight: true },
  ships: [ship("a1", "ATTACKER"), ship("d1", "DEFENDER")],
  divisions: [],
  log: [
    { minute: 1, eventType: "resolve_movement_intent", actorId: "pipeline", targetId: "" },
    { minute: 1, eventType: "contact_created", actorId: "obs-bat:a1", targetId: "bat:a1" },
    { minute: 1, eventType: "contact_created", actorId: "obs-bat:d1", targetId: "bat:d1" },
    { minute: 2, eventType: "contact_updated", actorId: "obs-bat:d1", targetId: "bat:d1" },
    { minute: 3, eventType: "gunnery_salvo", actorId: "a1:MAIN", targetId: "bat:d1" },
    { minute: 3, eventType: "damage_impact", actorId: "a1:MAIN", targetId: "d1" },
    { minute: 3, eventType: "smoke_fire", actorId: "fire-smoke:d1", targetId: "DECK" },
  ],
};

describe("ship id extraction", () => {
  it.each([
    ["bat:d1", "d1"],
    ["obs-bat:d1", "d1"],
    ["a1:MAIN", "a1"],
    ["fire-smoke:d1", "d1"],
    ["d1", "d1"],
  ])("reads %s as %s", (reference, expected) => {
    expect(shipIdOf(reference, "bat")).toBe(expected);
  });
});

describe("combat log projection", () => {
  it("opens with the battle start and drops pipeline stages and contact refreshes", () => {
    const entries = projectCombatLog(BASE);
    expect(entries[0]?.messageKey).toBe("tactical.log.battle_start");
    expect(entries.map((entry) => entry.messageKey)).not.toContain("tactical.log.contact_updated");
    expect(entries.some((entry) => entry.params["actor"] === "pipeline")).toBe(false);
  });

  it("reports only hostile sightings, never the enemy sighting the player's own ships", () => {
    const sightings = projectCombatLog(BASE).filter((entry) => entry.category === "contact");
    expect(sightings.map((entry) => entry.targetShipId)).toEqual(["d1"]);
  });

  it("keeps stable sequence numbers taken from the structured log", () => {
    const entries = projectCombatLog(BASE);
    const sequences = entries.map((entry) => entry.sequence);
    expect(sequences).toEqual([...sequences].sort((a, b) => a - b));
    expect(
      entries.find((entry) => entry.messageKey === "tactical.log.gunnery_salvo")?.sequence,
    ).toBe(4);
  });

  it("names ships from the view and carries the structured ids", () => {
    const salvo = projectCombatLog(BASE).find(
      (entry) => entry.messageKey === "tactical.log.gunnery_salvo",
    );
    expect(salvo).toMatchObject({
      category: "fire",
      actorShipId: "a1",
      targetShipId: "d1",
      params: { actor: "Ship a1", target: "Ship d1" },
    });
  });

  it("closes with the battle end only once the battle has ended", () => {
    expect(projectCombatLog(BASE).at(-1)?.messageKey).not.toBe("tactical.log.battle_end");
    const ended = projectCombatLog({ ...BASE, ended: true, endReason: "withdrawal_complete" });
    expect(ended.at(-1)).toMatchObject({
      messageKey: "tactical.log.battle_end",
      params: { reason: "withdrawal_complete" },
    });
  });
});

describe("transient markers", () => {
  it("shows only this minute's firing lines and impacts", () => {
    const entries = projectCombatLog(BASE);
    expect(transientMarkers(entries, 3)).toEqual({
      firing: [{ actorShipId: "a1", targetShipId: "d1" }],
      impacts: ["d1"],
    });
    expect(transientMarkers(entries, 2)).toEqual({ firing: [], impacts: [] });
  });
});
