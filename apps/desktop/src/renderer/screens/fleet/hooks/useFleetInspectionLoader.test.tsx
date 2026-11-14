import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import {
  FleetInspectionContext,
  useFleetInspectionCache,
  useFleetInspectionLoader,
  type LoadFleetInspection,
} from "./useFleetInspection.js";

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  loads: [] as LoadFleetInspection[],
}));
vi.mock("../../../lib/bridge-context.js", () => ({
  useBridge: () => ({ campaign: { execute: mocks.execute } }),
}));
vi.mock("../../../shell/CampaignShellContext.js", () => ({
  useCampaignRevision: () => 1,
}));

function SectionProbe() {
  mocks.loads.push(useFleetInspectionLoader("ses-1"));
  return null;
}

function ScreenShell() {
  const load = useFleetInspectionCache("ses-1");
  return (
    <FleetInspectionContext value={load}>
      <SectionProbe />
      <SectionProbe />
      <SectionProbe />
      <SectionProbe />
    </FleetInspectionContext>
  );
}

describe("useFleetInspectionLoader under a screen", () => {
  afterEach(() => {
    cleanup();
    mocks.execute.mockReset();
    mocks.loads.length = 0;
  });

  it("issues one inspectFleetScreen read for all sections loading at the same revision", async () => {
    mocks.execute.mockResolvedValue({ outcome: "success", value: { revision: 1 } });
    render(<ScreenShell />);
    expect(mocks.loads).toHaveLength(4);
    await Promise.all(mocks.loads.flatMap((load) => [load(), load()]));
    expect(mocks.execute).toHaveBeenCalledTimes(1);
    expect(mocks.execute).toHaveBeenCalledWith("inspectFleetScreen", "ses-1");
  });
});
