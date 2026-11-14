import { runEventCatalogue } from "./event-catalogue-run.js";

const SEED = "event-catalogue-cross-process-seed";
const MONTHS = 60;

try {
  const run = runEventCatalogue(SEED, MONTHS);
  process.stdout.write(JSON.stringify({ success: true, run }) + "\n");
} catch (err) {
  process.stdout.write(JSON.stringify({ success: false, error: String(err) }) + "\n");
}
