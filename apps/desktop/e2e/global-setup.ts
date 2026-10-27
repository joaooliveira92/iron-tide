import { existsSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

export default function globalSetup(): void {
  const executablePath = require("electron") as string;
  if (!existsSync(executablePath)) {
    throw new Error(`Electron executable missing at ${executablePath}`);
  }
}
