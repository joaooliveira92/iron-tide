// S-5 11 (#87): cross-process child for the S-5 acceptance scenario. Prints the observation as one JSON line.
import { runS5Acceptance } from "./s5-acceptance.js";

try {
  process.stdout.write(JSON.stringify(runS5Acceptance()) + "\n");
} catch (err) {
  process.stdout.write(JSON.stringify({ error: String(err) }) + "\n");
}
