// usage: node run-months.mjs <months> <interpretationId> <outfile>
import { writeFileSync } from "node:fs";
import { compileProductionCampaign, applyInterpretation, INTERPRETATIONS, runMonths, DATA } from "./lib.mjs";
import { resolve } from "node:path";
const [months, interpId, out] = [Number(process.argv[2]), process.argv[3], process.argv[4]];
const { state, contentHash } = compileProductionCampaign();
const snap = applyInterpretation(state.snapshot, INTERPRETATIONS[interpId]);
const t0 = Date.now();
const { rows } = runMonths(snap, months);
writeFileSync(resolve(DATA, out), JSON.stringify({ interpId, desc: INTERPRETATIONS[interpId].desc, months, contentHash, rows }));
console.log(interpId, months, "months", rows.length, "rows", (Date.now() - t0) / 1000, "s");
