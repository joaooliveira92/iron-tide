import { runT1Acceptance } from "./t1-acceptance.js";

try {
  process.stdout.write(JSON.stringify(runT1Acceptance()) + "\n");
} catch (err) {
  process.stdout.write(JSON.stringify({ error: String(err) }) + "\n");
}
