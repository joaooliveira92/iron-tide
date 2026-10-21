// T-1 10 (#119): cross-process child for the T-1 acceptance scenario. Prints the observation as one JSON line.
import { runT1Acceptance } from "./t1-acceptance.js";

try {
  process.stdout.write(JSON.stringify(runT1Acceptance()) + "\n");
} catch (err) {
  process.stdout.write(JSON.stringify({ error: String(err) }) + "\n");
}
