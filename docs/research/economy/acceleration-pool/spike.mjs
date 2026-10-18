// Spike for #138 slice 4 / G3: what would a national acceleration-pressure pool (DESIGN-13 section 11.3.3, treasury units per
// month) be if it were defined as the per-line capacity of the yard that fits the dock-size reference hull, priced by the cost
// model, times shipyardCapacityMultipleBp / 10000? Read-only: imports built workspace output, writes only the JSON beside it.
// Run from the repo root after `pnpm build`:  node docs/research/economy/acceleration-pool/spike.mjs
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..", "..", "..", "..");
const imp = (rel) => import(pathToFileURL(resolve(ROOT, rel)).href);

const { compileProductionBundle } = await imp("packages/cross-process-test/dist/production-pack.js");
const sd = await imp("packages/ship-design/dist/index.js");

const { bundle } = compileProductionBundle();
const c = bundle.shipBuilding;
const content = sd.buildShipBuildingContent({
  components: c.components,
  plants: c.plants,
  hullForms: c.hullForms,
  balance: c.balance,
  technologies: bundle.technologies,
  navalProfiles: c.navalProfiles,
  armament: c.armament,
  referenceDesigns: c.referenceDesigns,
  ...(c.partModel !== undefined ? { partModel: c.partModel } : {}),
  ...(c.designLoadouts !== undefined ? { designLoadouts: c.designLoadouts } : {}),
});

const MONTH = "1880-01";
const rows = [];
for (const profile of [...content.navalProfiles].sort((a, b) => (a.nationId < b.nationId ? -1 : 1))) {
  const env = content.environmentFor(MONTH, profile.nationId);
  const dockKg = profile.dock.maximumNewConstructionMassKg;
  const multipleBp = env.constructionBalance.shipyardCapacityMultipleBp;
  // The dock-size reference hull: the nation's largest starter design that fits its dock.
  let reference = null;
  for (const starter of content.starterDesigns.filter((s) => s.draft.nationId === profile.nationId)) {
    const view = sd.buildWorkshopView(starter.draft, env);
    if (!view.valid || view.totalKg > dockKg) continue;
    if (reference === null || view.totalKg > reference.view.totalKg) reference = { starter, view };
  }
  if (reference === null) {
    rows.push({ nationId: profile.nationId, dockKg, note: "no starter design fits the dock" });
    continue;
  }
  const { starter, view } = reference;
  const units = sd.treasuryCostUnits(view.forecast.costMicro, content.treasuryUnitMicro);
  const plan = sd.planConstruction(view.compiled, starter.draft, view.forecast.costBreakdown, env.constructionBalance, true);
  const choice = sd.chooseYard(plan, sd.yardDemandOf(view.compiled, starter.draft), env.yards, env.constructionBalance, view.compiled.totalKg, {
    month: MONTH,
    industryBp: env.industryBp,
  });
  if (choice.best === null) {
    rows.push({ nationId: profile.nationId, dockKg, reference: starter.id, note: "no yard finishes the reference hull" });
    continue;
  }
  const perLine = sd.capacityInUnits(choice.best.yard.capacity, plan, units);
  const perMonth = Object.values(perLine).reduce((a, b) => a + b, 0);
  rows.push({
    nationId: profile.nationId,
    dockKg,
    reference: starter.id,
    referenceKg: view.totalKg,
    referenceUnits: units,
    yardId: choice.best.yard.facility.id,
    capacityUnitsPerLine: perLine,
    capacityUnitsPerMonth: perMonth,
    multipleBp,
    candidatePoolUnitsPerMonth: Math.floor((perMonth * multipleBp) / 10_000),
  });
}

writeFileSync(resolve(HERE, "pool.json"), JSON.stringify(rows, null, 2) + "\n");
console.log(JSON.stringify(rows, null, 2));
