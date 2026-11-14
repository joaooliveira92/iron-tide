import { cleanup, render } from "@testing-library/react";
import type { DivisionView } from "@bluewave/campaign-engine";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { CommandOutcome } from "../../../lib/command-screen-workflow.js";
import { FleetOrganizationView } from "./FleetOrganizationSection.js";
import {
  initialDivisionOrganizationState,
  type DivisionOrganizationState,
} from "./division-organization-state.js";

const headerRenders = vi.hoisted(() => ({ count: 0 }));

vi.mock("./DivisionCardIdentity.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./DivisionCardIdentity.js")>();
  const CountedHeader = () => {
    headerRenders.count += 1;
    return <actual.DivisionCardHeader />;
  };
  return { ...actual, DivisionCardHeader: CountedHeader };
});

const division = (divisionId: string, areaId: string): DivisionView => ({
  divisionId,
  role: "CORE",
  formation: "LINE_AHEAD",
  flagshipShipId: `${divisionId}-flag`,
  flagshipName: `${divisionId} flagship`,
  commanderVacant: true,
  experience: 20,
  cohesion: 30,
  areaId,
  areaName: "English Home Waters",
  ships: [{ shipId: `${divisionId}-flag`, name: `${divisionId} flagship` }],
});

function makeState(): DivisionOrganizationState {
  return {
    ...initialDivisionOrganizationState(),
    divisions: [division("div_a", "home"), division("div_b", "home"), division("div_c", "home")],
    roles: ["INDEPENDENT", "CORE", "SUPPORT"],
    formations: ["LINE_AHEAD", "LINE_ABREAST"],
    maxShips: 5,
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
  };
}

function view(
  state: DivisionOrganizationState,
  send: (command: unknown) => Promise<CommandOutcome>,
  overrides: { loadError?: string | null; onRetry?: () => void } = {},
) {
  return (
    <FleetOrganizationView
      state={state}
      loadError={overrides.loadError ?? null}
      busy={false}
      outcomeUnknown={false}
      onRetry={overrides.onRetry ?? (() => undefined)}
      onReload={() => undefined}
      send={send}
    />
  );
}

describe("FleetOrganizationView division cards", () => {
  beforeEach(() => {
    headerRenders.count = 0;
  });
  afterEach(cleanup);

  it("renders each division card once per mount", () => {
    render(view(makeState(), () => Promise.resolve("accepted")));
    expect(headerRenders.count).toBe(3);
  });

  it("does not re-render division cards when the parent re-renders with unchanged card inputs", () => {
    const state = makeState();
    const send = (): Promise<CommandOutcome> => Promise.resolve("accepted");
    const { rerender } = render(view(state, send));
    expect(headerRenders.count).toBe(3);

    rerender(view(state, send, { loadError: "unrelated banner", onRetry: () => undefined }));

    expect(headerRenders.count).toBe(3);
  });
});
