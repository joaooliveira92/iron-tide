import { runPeaceAcceptance } from "./peace-acceptance.js";

try {
  process.stdout.write(`${JSON.stringify(runPeaceAcceptance())}\n`);
} catch (error) {
  process.stdout.write(
    `${JSON.stringify({ error: error instanceof Error ? error.message : String(error) })}\n`,
  );
}
