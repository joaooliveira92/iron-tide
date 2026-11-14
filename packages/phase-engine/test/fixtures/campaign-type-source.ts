import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect } from "vite-plus/test";

const CAMPAIGN_SRC = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "campaign",
  "src",
);

const SOURCE_FILE_BY_TYPE: Readonly<Record<string, string>> = {
  PermanentDivision: "division.ts",
  Officer: "officers.ts",
  DeclinedBattleRecord: "declineRecords.ts",
  DeclineCounterEntry: "declineRecords.ts",
  WarOptionalRecords: "warRecords.ts",
  PeaceOffer: "peaceOffer.ts",
};

const sources = new Map<string, string>();

function sourceForType(typeName: string): string {
  const file = SOURCE_FILE_BY_TYPE[typeName] ?? "state.ts";
  const cached = sources.get(file);
  if (cached !== undefined) return cached;
  const text = readFileSync(resolve(CAMPAIGN_SRC, file), "utf8");
  sources.set(file, text);
  return text;
}

export function declaredFields(name: string): string[] {
  const source = sourceForType(name);
  const schemaHeader = new RegExp(`export const ${name}Schema = Schema\\.Struct\\(\\{`);
  const interfaceHeader = new RegExp(
    `export interface ${name}(?:\\s+extends\\s+([\\w, ]+?))?\\s*\\{`,
  );
  const schemaStart = source.search(schemaHeader);
  const start = schemaStart === -1 ? source.search(interfaceHeader) : schemaStart;
  const inherited =
    schemaStart === -1
      ? (source.match(interfaceHeader)?.[1]?.split(",") ?? []).flatMap((parent) =>
          declaredFields(parent.trim()),
        )
      : [];
  expect(start, `no declaration for ${name} in the campaign type source`).toBeGreaterThanOrEqual(0);
  const bodyStart = source.indexOf("{", start) + 1;
  const close = source.indexOf("\n}", bodyStart);
  expect(close, `${name} block not closed in source`).toBeGreaterThanOrEqual(0);
  const fields: string[] = [...inherited];
  for (const line of source.slice(bodyStart, close).split("\n")) {
    const match = line.match(/^\s*([A-Za-z_$][\w$]*)(\?)?:/);
    if (match) {
      const field = match[1]!;
      if (!fields.includes(field)) fields.push(field);
    }
  }
  return fields;
}
