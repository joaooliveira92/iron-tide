import { runS5Acceptance } from "./s5-acceptance.js";

try {
  process.stdout.write(JSON.stringify(runS5Acceptance()) + "\n");
} catch (err) {
  process.stdout.write(JSON.stringify({ error: String(err) }) + "\n");
}
