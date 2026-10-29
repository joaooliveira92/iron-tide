import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadContentModule } from "@bluewave/content-compiler";
import { ShipComponentCatalogueSchema, decodeStrict } from "@bluewave/content-schema";

import type { ComponentDef } from "../../src/index.js";

export interface ComponentFiles {
  readonly components: ComponentDef[];
  readonly sourceById: ReadonlyMap<string, string>;
}

const readAuthored = (root: string, file: string): unknown => {
  const loaded = loadContentModule(join(root, file));
  if (!loaded.ok) throw new Error(`${file}: ${loaded.message}`);
  return loaded.document;
};

export function readComponentFiles(root: string): ComponentFiles {
  const pack = JSON.parse(readFileSync(join(root, "pack.json"), "utf8")) as {
    shipBuilding: { shipComponents: string[] };
  };
  const components = pack.shipBuilding.shipComponents.flatMap((file) => {
    const document = decodeStrict(ShipComponentCatalogueSchema, readAuthored(root, file));
    return document.components.map((component) => ({ ...component, sourceFile: file }));
  }) as ComponentDef[];
  return {
    components,
    sourceById: new Map(components.map((component) => [component.id, component.sourceFile!])),
  };
}
