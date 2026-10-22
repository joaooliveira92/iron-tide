import { runT2Acceptance } from "./t2-acceptance.js";

try {
  process.stdout.write(`${JSON.stringify(runT2Acceptance())}\n`);
} catch (error) {
  process.stdout.write(
    `${JSON.stringify({ error: error instanceof Error ? error.message : String(error) })}\n`,
  );
}
