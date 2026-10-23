import { runS2Acceptance } from "./s2-acceptance.js";

try {
  process.stdout.write(JSON.stringify(runS2Acceptance()) + "\n");
} catch (err) {
  process.stdout.write(JSON.stringify({ error: String(err) }) + "\n");
}
