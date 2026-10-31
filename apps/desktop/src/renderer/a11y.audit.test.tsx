import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type {
  BattleHistoryEntry,
  DivisionView,
  StrategicPriority,
} from "@bluewave/campaign-engine";
import { afterEach, beforeAll, describe, expect, it, vi } from "vite-plus/test";
import { DeferredFeaturesPanel } from "./components/shared/DeferredFeaturesPanel.js";
import { WorldMapChart } from "./components/world-map/WorldMapChart.js";
import { initialMapPrototypeState } from "./components/world-map/map-state.js";
import { axeViolations } from "./lib/axe.js";
import { loadDrawingBoardContent } from "./components/design-workspace/content.js";
import { ShipbuildingWorkspace } from "./screens/shipbuilding/ShipbuildingWorkspace.js";
import { armMove, armPlace, openSection } from "./screens/shipbuilding/test-helpers.js";
import { BattleHistorySection } from "./screens/diplomacy/components/BattleHistorySection.js";
import { AreaOverviewTable } from "./screens/fleet/components/AreaOverviewTable.js";
import { MovementCommandsTable } from "./screens/fleet/components/MovementCommandsTable.js";
import { FleetOrganizationView } from "./screens/fleet/organization/FleetOrganizationSection.js";
import { initialDivisionOrganizationState } from "./screens/fleet/organization/division-organization-state.js";
import { NewGameFleetMethodScreen } from "./screens/new-game/NewGameFleetMethodScreen.js";
import { defaultFleetMethod } from "./screens/new-game/new-game-fleet-method-screen-state.js";
import { OptionsScreen } from "./screens/options/OptionsScreen.js";
import { PrioritiesCard } from "./screens/overview/PrioritiesCard.js";
import { FlowBar } from "./screens/treasury/components/FlowBar.js";
import { BackgroundProvider } from "./shell/BackgroundContext.js";
import { BottomNav } from "./shell/BottomNav.js";
import { DensityProvider } from "./shell/DensityContext.js";
import { FontProvider } from "./shell/FontContext.js";
import { ThemeProvider } from "./shell/ThemeContext.js";

const noop = () => undefined;

const division: DivisionView = {
  divisionId: "div_1",
  role: "CORE",
  formation: "LINE_AHEAD",
  flagshipShipId: "alex",
  flagshipName: "HMS Alexandra",
  commanderVacant: true,
  experience: 20,
  cohesion: 30,
  areaId: "home",
  areaName: "English Home Waters",
  ships: [
    { shipId: "alex", name: "HMS Alexandra" },
    { shipId: "dread", name: "HMS Dreadnought" },
  ],
};

const priority: StrategicPriority = {
  id: "p1",
  type: "monthly_deficit",
  severity: "warning",
  title: "Monthly deficit",
  summary: "Projected balance -56.",
  reason: "r",
  destination: "treasury" as never,
  fingerprint: "p1",
};

const battle: BattleHistoryEntry = {
  sequence: 1,
  battleId: "b1",
  areaId: "a",
  areaName: "English Home Waters",
  attackerId: "uk",
  attackerName: "Britain",
  defenderId: "france",
  defenderName: "France",
  involvesPlayer: true,
  outcomeForPlayer: "won",
  playerLossCount: 1,
  enemyLossCount: 3,
  lostShipIds: [],
  lostShips: [],
};

describe("accessibility audit (axe-core)", () => {
  beforeAll(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    window.matchMedia ??= vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
  });
  afterEach(cleanup);

  const audit = async (ui: React.ReactElement) => {
    const { container } = render(ui);
    expect(await axeViolations(container)).toEqual([]);
  };

  it("Fleet organization — empty and with divisions", async () => {
    const base = {
      ...initialDivisionOrganizationState(),
      roles: ["INDEPENDENT", "CORE"],
      formations: ["LINE_AHEAD", "LINE_ABREAST"],
      initial: { experience: 20, cohesion: 30 },
      penalties: {
        addShip: { experience: 5, cohesion: 10 },
        removeShip: { experience: 3, cohesion: 5 },
        changeFlagship: { experience: 5, cohesion: 10 },
        changeCommander: { experience: 5, cohesion: 10 },
        reorder: { experience: 0, cohesion: 3 },
        changeRole: { experience: 0, cohesion: 10 },
        changeFormation: { experience: 0, cohesion: 5 },
      },
      unassignedShips: [
        {
          shipId: "inflex",
          name: "HMS Inflexible",
          classId: "c",
          areaId: "home",
          areaName: "English Home Waters",
        },
        { shipId: "temp", name: "HMS Temeraire", classId: "c", areaId: "malta", areaName: "Malta" },
      ],
    };
    const props = {
      loadError: null,
      busy: false,
      outcomeUnknown: false,
      onRetry: noop,
      onReload: noop,
      send: () => Promise.resolve("accepted" as const),
    };
    await audit(<FleetOrganizationView state={base} {...props} />);
    cleanup();
    await audit(
      <FleetOrganizationView
        state={{ ...base, divisions: [division], notice: "Create division queued." }}
        {...props}
      />,
    );
  });

  it("Overview priorities", async () => {
    await audit(
      <PrioritiesCard state={{ status: "ready", priorities: [priority] }} onNavigate={noop} />,
    );
  });

  it("Treasury flow bar", async () => {
    await audit(
      <FlowBar
        previewResearch={null}
        active={null}
        onActive={noop}
        breakdown={{
          income: 20,
          obligations: 0,
          fleetMaintenance: 16,
          researchSpend: 60,
          researchRequested: 60,
          researchCap: 240,
          researchUnfundedReason: undefined,
          plannedConstruction: 0,
          totalExpenditure: 76,
          projectedSurplusDeficit: -56,
          status: "critical",
          shortfall: 0,
          availableFunds: 1000,
          projectedMonthEndFunds: 944,
          runwayMonths: undefined,
          netExplanation: undefined,
          monthEndExplanation: undefined,
          runwayExplanation: undefined,
          appropriationExplanation: undefined,
        }}
      />,
    );
  });

  it("Deferred-features panel, battle history, area overview, movement table", async () => {
    await audit(
      <DeferredFeaturesPanel
        testId="d"
        items={[{ id: "a", name: "Alpha", reason: "Because alpha." }]}
      />,
    );
    cleanup();
    await audit(
      <BattleHistorySection state={{ status: "ready", history: { battles: [battle] } }} />,
    );
    cleanup();
    await audit(
      <AreaOverviewTable
        rows={[
          {
            areaId: "a",
            name: "Malta",
            ports: ["Valletta"],
            divisions: [],
            neighbours: ["Algeria"],
          },
        ]}
      />,
    );
    cleanup();
    await audit(
      <MovementCommandsTable
        rows={[
          {
            commandId: "c1",
            divisionName: "1st Battle Squadron",
            fromName: "Malta",
            toName: "Algiers",
            status: "submitted",
            submittedAtRevision: 1,
          },
        ]}
      />,
    );
  });

  it("Bottom navigation", async () => {
    await audit(<BottomNav screen="overview" onSelect={noop} />);
  });

  it("Options (appearance and display)", async () => {
    await audit(
      <ThemeProvider>
        <BackgroundProvider>
          <DensityProvider>
            <FontProvider>
              <OptionsScreen />
            </FontProvider>
          </DensityProvider>
        </BackgroundProvider>
      </ThemeProvider>,
    );
  });

  it("Starting-fleet method picker (BounceCards deck, caption and comparison legend)", async () => {
    await audit(
      <NewGameFleetMethodScreen
        initialFleetMethod={defaultFleetMethod()}
        status="ready"
        error={null}
        onBack={noop}
        onNext={noop}
        onPrimaryActionChange={noop}
      />,
    );
  });

  it("World map — full and embedded panel variants", async () => {
    const props = {
      state: initialMapPrototypeState,
      route: null,
      onSelect: noop,
      onRuler: noop,
      onToggleLayer: noop,
      onSetProjection: noop,
      onSetCentre: noop,
      onToggleClosedPassages: noop,
    };
    await audit(<WorldMapChart {...props} />);
    cleanup();
    await audit(<WorldMapChart {...props} variant="panel" />);
  });

  const BOARD_TIMEOUT_MS = 120_000;
  const openWorkspace = () => render(<ShipbuildingWorkspace sessionId="audit" />).container;

  it(
    "Ship design — every panel and every drawing",
    async () => {
      const container = openWorkspace();
      expect(await axeViolations(container), "closed").toEqual([]);
      for (const section of [
        "Overview",
        "Hull",
        "Machinery",
        "Protection",
        "Armament",
        "Systems",
        "Review",
      ]) {
        openSection(section);
        expect(await axeViolations(container), section).toEqual([]);
      }
      for (const view of ["Side", "Isometric", "Top"]) {
        fireEvent.click(screen.getByRole("button", { name: view }));
        expect(await axeViolations(container), view).toEqual([]);
      }
    },
    BOARD_TIMEOUT_MS,
  );

  it(
    "Ship design — a flawed design raises an accessible problem slip",
    async () => {
      const container = openWorkspace();
      openSection("Machinery");
      const fuel = screen.getByLabelText(/^Fuel capacity/) as HTMLInputElement;
      fireEvent.change(fuel, { target: { value: "400" } });
      fireEvent.blur(fuel);
      await screen.findByTestId("flaw-slip");
      expect(await axeViolations(container), "flaw slip").toEqual([]);
    },
    BOARD_TIMEOUT_MS,
  );

  it(
    "Ship design — the plan's context menu and both tool modes",
    async () => {
      const container = openWorkspace();
      fireEvent.contextMenu(screen.getByRole("group", { name: /^Ship plan/ }));
      await screen.findByRole("menuitem", { name: "Place" });
      expect(
        (await axeViolations(document.body)).filter((v) => !v.startsWith("region ")),
        "context menu",
      ).toEqual([]);
      fireEvent.keyDown(screen.getByRole("menuitem", { name: "Place" }), { key: "Escape" });
      await armMove();
      expect(await axeViolations(container), "Move armed").toEqual([]);
      await armPlace(
        loadDrawingBoardContent().components.find((c) => c.id === "pumps_damage_control")!,
      );
      expect(await axeViolations(container), "Place armed").toEqual([]);
    },
    BOARD_TIMEOUT_MS,
  );

  it(
    "Ship design — the drawing key popover (a portal, so the whole document is audited)",
    async () => {
      openWorkspace();
      fireEvent.click(screen.getByRole("button", { name: "Drawing key" }));
      await screen.findByText("Schematic design views, not construction drawings", {
        exact: false,
      });
      expect((await axeViolations(document.body)).filter((v) => !v.startsWith("region "))).toEqual(
        [],
      );
    },
    BOARD_TIMEOUT_MS,
  );

  it("control: the harness really catches violations (so a clean result means something)", async () => {
    const { container } = render(
      <div>
        <button type="button" />
        <img src="x.png" />
        <input type="text" />
      </div>,
    );
    const violations = await axeViolations(container);
    expect(violations.length).toBeGreaterThanOrEqual(3);
    const ids = violations.map((v) => v.split(" ")[0]);
    expect(ids).toEqual(expect.arrayContaining(["button-name", "image-alt", "label"]));
  });
});
