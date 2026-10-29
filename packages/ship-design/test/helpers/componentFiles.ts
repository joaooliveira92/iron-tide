import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { ShipComponentCatalogueSchema, decodeStrict } from "@bluewave/content-schema";

import type { ComponentDef } from "../../src/index.js";

export interface ComponentFiles {
  readonly components: ComponentDef[];
  readonly sourceById: ReadonlyMap<string, string>;
}

export function readComponentFiles(root: string): ComponentFiles {
  const pack = JSON.parse(readFileSync(join(root, "pack.json"), "utf8")) as {
    shipBuilding: { shipComponents: string[] };
  };
  const components = pack.shipBuilding.shipComponents.flatMap((file) => {
    const document = decodeStrict(
      ShipComponentCatalogueSchema,
      parse(readFileSync(join(root, file), "utf8")),
    );
    return document.components.map((component) => ({ ...component, sourceFile: file }));
  }) as ComponentDef[];
  return {
    components,
    sourceById: new Map(components.map((component) => [component.id, component.sourceFile!])),
  };
}
