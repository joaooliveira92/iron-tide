export const CHART_NODE_WIDTH = 208;
export const CHART_NODE_HEIGHT = 84;
export const CHART_GAP_X = 64;
export const CHART_GAP_Y = 16;
export const CHART_PADDING = 16;

export interface ChartTechSpec {
  readonly techId: string;
  readonly prerequisiteIds: readonly string[];
  readonly cost: number;
}

export interface ChartNodeLayout {
  readonly techId: string;
  readonly tier: number;
  readonly row: number;
  readonly x: number;
  readonly y: number;
  readonly externalPrerequisiteIds: readonly string[];
}

export interface ChartEdgeLayout {
  readonly fromId: string;
  readonly toId: string;
  readonly path: string;
}

export interface ChartLayout {
  readonly nodes: readonly ChartNodeLayout[];
  readonly edges: readonly ChartEdgeLayout[];
  readonly width: number;
  readonly height: number;
}

const byCostThenId = (a: ChartTechSpec, b: ChartTechSpec) =>
  a.cost - b.cost || (a.techId < b.techId ? -1 : a.techId > b.techId ? 1 : 0);

export function layoutFieldChart(techs: readonly ChartTechSpec[]): ChartLayout {
  const specs = new Map(techs.map((t) => [t.techId, t] as const));
  const inField = (t: ChartTechSpec) => t.prerequisiteIds.filter((id) => specs.has(id));

  const tiers = new Map<string, number>();
  const visiting = new Set<string>();
  const tierOf = (techId: string): number => {
    const known = tiers.get(techId);
    if (known !== undefined) return known;
    if (visiting.has(techId)) return 0;
    visiting.add(techId);
    const spec = specs.get(techId)!;
    const parents = inField(spec);
    const tier = parents.length === 0 ? 0 : 1 + Math.max(...parents.map(tierOf));
    visiting.delete(techId);
    tiers.set(techId, tier);
    return tier;
  };
  for (const t of techs) tierOf(t.techId);

  const tierCount = techs.length === 0 ? 0 : Math.max(...tiers.values()) + 1;
  const rows = new Map<string, number>();
  for (let tier = 0; tier < tierCount; tier += 1) {
    const members = techs.filter((t) => tiers.get(t.techId) === tier);
    const anchor = (t: ChartTechSpec) => {
      const parents = inField(t);
      return parents.length === 0
        ? Number.POSITIVE_INFINITY
        : parents.reduce((sum, id) => sum + (rows.get(id) ?? 0), 0) / parents.length;
    };
    members
      .slice()
      .sort((a, b) => anchor(a) - anchor(b) || byCostThenId(a, b))
      .forEach((t, row) => rows.set(t.techId, row));
  }

  const position = (techId: string) => ({
    x: CHART_PADDING + tiers.get(techId)! * (CHART_NODE_WIDTH + CHART_GAP_X),
    y: CHART_PADDING + rows.get(techId)! * (CHART_NODE_HEIGHT + CHART_GAP_Y),
  });

  const nodes = techs.map((t): ChartNodeLayout => {
    const { x, y } = position(t.techId);
    return {
      techId: t.techId,
      tier: tiers.get(t.techId)!,
      row: rows.get(t.techId)!,
      x,
      y,
      externalPrerequisiteIds: t.prerequisiteIds.filter((id) => !specs.has(id)),
    };
  });

  const edges = techs.flatMap((t) =>
    inField(t).map((fromId): ChartEdgeLayout => {
      const from = position(fromId);
      const to = position(t.techId);
      const x1 = from.x + CHART_NODE_WIDTH;
      const y1 = from.y + CHART_NODE_HEIGHT / 2;
      const x2 = to.x;
      const y2 = to.y + CHART_NODE_HEIGHT / 2;
      const bend = (x2 - x1) / 2;
      return {
        fromId,
        toId: t.techId,
        path: `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`,
      };
    }),
  );

  const rowCount = rows.size === 0 ? 0 : Math.max(...rows.values()) + 1;
  return {
    nodes,
    edges,
    width:
      CHART_PADDING * 2 + tierCount * CHART_NODE_WIDTH + Math.max(0, tierCount - 1) * CHART_GAP_X,
    height:
      CHART_PADDING * 2 + rowCount * CHART_NODE_HEIGHT + Math.max(0, rowCount - 1) * CHART_GAP_Y,
  };
}

export function relatedTechIds(layout: ChartLayout, techId: string): ReadonlySet<string> {
  const related = new Set<string>([techId]);
  const walk = (start: string, next: (e: ChartEdgeLayout) => string | null) => {
    const queue = [start];
    while (queue.length > 0) {
      const id = queue.shift()!;
      for (const edge of layout.edges) {
        const other = next(edge) === id ? (edge.fromId === id ? edge.toId : edge.fromId) : null;
        if (other !== null && !related.has(other)) {
          related.add(other);
          queue.push(other);
        }
      }
    }
  };
  walk(techId, (e) => e.toId);
  walk(techId, (e) => e.fromId);
  return related;
}
