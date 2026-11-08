import { cleanup, render } from "@testing-library/react";
import { pickerOptions } from "@bluewave/ship-design";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { loadDrawingBoardContent } from "../../../../components/design-workspace/content.js";
import { pickerQueryOf } from "../../../../components/design-workspace/pickerFilters.js";
import type { ArmamentEntry, ArmamentMount } from "../../armament.js";
import { ArmamentEditingProvider, useArmamentEditing } from "./ArmamentEditing.js";

afterEach(cleanup);

const content = loadDrawingBoardContent();
const ref = content.references[0]!;
const env = content.environmentFor(ref.month, ref.draft.nationId);
const entryId = "gun_bl_10in_32";

const mount: ArmamentMount = {
  instanceId: "probe_1",
  componentId: entryId,
  name: "Probe",
  side: "CENTRE",
  position: "Fore",
  zoneId: "TURRET",
  stationPermille: 300,
  barrels: 2,
  rounds: 80,
  caliberUm: 254000,
  displayName: "Probe",
  mountType: null,
  fcClass: null,
  weightKg: 0,
  costMicro: 0,
  arcDeg: null,
  layout: "",
};

const entry: ArmamentEntry = {
  row: {
    key: "main",
    role: "MAIN",
    caliberUm: 254000,
    mounts: 1,
    barrels: 2,
    roundsPerGun: 80,
    weightKg: 0,
    instanceIds: ["probe_1"],
  },
  title: "Main",
  mounts: [mount],
};

function candidatesFor(month: string): readonly string[] {
  let ids: readonly string[] = [];
  const Probe = () => {
    ids = useArmamentEditing().replaceCandidates.map((c) => c.id);
    return null;
  };
  render(
    <ArmamentEditingProvider
      entries={[entry]}
      draft={ref.draft}
      content={content}
      findings={[]}
      month={month}
      unlockedTechs={env.ctx.unlockedTechs}
      edit={() => {}}
      selectedInstanceId="probe_1"
    >
      <Probe />
    </ArmamentEditingProvider>,
  );
  return ids;
}

describe("replace candidates (#575)", () => {
  it("equal the shared picker result for the same inputs, minus the mounted part", () => {
    const picked = content.catalogue.find((e) => e.id === entryId)!;
    const shared = pickerOptions(
      content.catalogue,
      pickerQueryOf(
        { month: ref.month, unlockedTechs: env.ctx.unlockedTechs, nationId: ref.draft.nationId },
        {
          showAllNations: false,
          showUnavailable: false,
          role: null,
          minCaliberUm: null,
        },
        picked.category,
      ),
    ).available.filter((e) => e.id !== entryId);
    expect(candidatesFor(ref.month)).toEqual(shared.map((e) => e.id));
  });

  it("offers a Royal Navy design no French or later-era gun", () => {
    const ids = candidatesFor(ref.month);
    expect(ids).not.toContain("gun_bl_274mm_m1875");
    expect(ids).not.toContain("gun_ap_16in_50_triple");
    expect(candidatesFor("1880-01")).not.toContain("gun_bl_12in_35");
  });
});
