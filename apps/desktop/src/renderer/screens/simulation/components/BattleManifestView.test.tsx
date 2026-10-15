/* @vitest-environment jsdom */
import type { BattleManifest } from "@bluewave/campaign-engine";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { BattleManifestView } from "./BattleManifestView.js";

/**
 * Render tests for the battle manifest readout. Each side's display name is
 * derived from its own canonical `nationId`, and the `(Player)`/`(AI)` role
 * from the session player nation id — never from column order or a hardcoded
 * nation. These fail against the old hardcoded UK/Germany literals.
 */
function manifestWith(attackerNationId: string, defenderNationId: string): BattleManifest {
  return {
    battleId: "battle_1",
    missionType: "surface_action",
    sides: [
      {
        sideId: "attacker",
        nationId: attackerNationId,
        participants: [
          { shipId: "HMS Majestic", divisionId: "Channel Squadron", nationId: attackerNationId },
          { shipId: "HMS Daring", divisionId: "Cruiser Squadron", nationId: attackerNationId },
        ],
      },
      {
        sideId: "defender",
        nationId: defenderNationId,
        participants: [
          { shipId: "SMS Wörth", divisionId: "High Seas Squadron", nationId: defenderNationId },
        ],
      },
    ],
  } as unknown as BattleManifest;
}

afterEach(() => {
  cleanup();
});

describe("BattleManifestView", () => {
  it("derives each side's name and role from canonical data", () => {
    render(<BattleManifestView manifest={manifestWith("uk", "germany")} playerNationId="uk" />);

    expect(screen.getByText("BATTLE: battle_1")).not.toBeNull();
    expect(screen.getByText("surface_action")).not.toBeNull();
    expect(screen.getByText("United Kingdom (Player)")).not.toBeNull();
    expect(screen.getByText("German Empire (AI)")).not.toBeNull();
    expect(screen.getByText("• HMS Majestic (Channel Squadron)")).not.toBeNull();
    expect(screen.getByText("• HMS Daring (Cruiser Squadron)")).not.toBeNull();
    expect(screen.getByText("• SMS Wörth (High Seas Squadron)")).not.toBeNull();
  });

  it("shows canonical names instead of the old UK/Germany literals", () => {
    render(
      <BattleManifestView manifest={manifestWith("france", "france")} playerNationId="france" />,
    );

    expect(screen.getAllByText(/French Republic/)).toHaveLength(2);
    expect(screen.queryByText(/United Kingdom/)).toBeNull();
    expect(screen.queryByText(/German Empire/)).toBeNull();
  });

  it("flips the player/AI role with the player nation id, not column order", () => {
    render(
      <BattleManifestView manifest={manifestWith("uk", "germany")} playerNationId="germany" />,
    );

    expect(screen.getByText("United Kingdom (AI)")).not.toBeNull();
    expect(screen.getByText("German Empire (Player)")).not.toBeNull();
  });

  it("omits the role suffix when the player nation id is unknown", () => {
    render(<BattleManifestView manifest={manifestWith("uk", "germany")} playerNationId={null} />);

    expect(screen.getByText("United Kingdom")).not.toBeNull();
    expect(screen.getByText("German Empire")).not.toBeNull();
    expect(screen.queryByText(/\(Player\)/)).toBeNull();
    expect(screen.queryByText(/\(AI\)/)).toBeNull();
  });

  it("keys the attacker/defender columns off sideId, not array order", () => {
    const base = manifestWith("uk", "germany");
    const reversed = { ...base, sides: [...base.sides].reverse() } as BattleManifest;

    render(<BattleManifestView manifest={reversed} playerNationId="uk" />);

    const attackerColumn = screen.getByText("ATTACKER").parentElement!;
    const defenderColumn = screen.getByText("DEFENDER").parentElement!;
    expect(within(attackerColumn).getByText("United Kingdom (Player)")).not.toBeNull();
    expect(within(defenderColumn).getByText("German Empire (AI)")).not.toBeNull();
  });

  it("falls back to the raw id for an unmapped nation id", () => {
    render(
      <BattleManifestView manifest={manifestWith("nation_uk", "GBR")} playerNationId="nation_uk" />,
    );

    expect(screen.getByText("nation_uk (Player)")).not.toBeNull();
    expect(screen.getByText("GBR (AI)")).not.toBeNull();
  });
});
