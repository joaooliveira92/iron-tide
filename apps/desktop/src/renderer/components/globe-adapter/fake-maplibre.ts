export interface FakeMap {
  readonly options: { readonly container: HTMLElement };
  readonly canvas: HTMLCanvasElement;
  markerHits: readonly { readonly properties: Record<string, unknown> }[];
  areaHits: readonly { readonly properties: Record<string, unknown> }[];
  readonly layoutCalls: { readonly id: string; readonly value: unknown }[];
  readonly filterCalls: { readonly id: string; readonly value: unknown }[];
  readonly dragPanCalls: string[];
  readonly panByCalls: { readonly x: number; readonly y: number }[];
  readonly panOptions: unknown[];
  readonly projectionCalls: unknown[];
  readonly bearingCalls: number[];
  boxZoomDisabled: boolean;
  doubleClickZoomDisabled: boolean;
  keyboardDisabled: boolean;
  readonly handlers: Map<string, ((event: unknown) => void)[]>;
  emit(event: string, payload: unknown): void;
  getCenter(): { readonly lng: number; readonly lat: number };
  getZoom(): number;
  getPitch(): number;
  getBearing(): number;
  getContainer(): HTMLElement;
  getCanvas(): HTMLCanvasElement;
  queryRenderedFeatures(
    point: unknown,
    options?: { readonly layers?: readonly string[] },
  ): readonly { readonly properties: Record<string, unknown> }[];
  getSource(id: string): { setData(data: unknown): void };
  setLayoutProperty(id: string, key: string, value: unknown): void;
  setFilter(id: string, value: unknown): void;
  setPaintProperty(id: string, key: string, value: unknown): void;
  setProjection(value: unknown): void;
  setFeatureState(): void;
  setCenter(value: unknown): void;
  setZoom(value: number): void;
  setBearing(value: number): void;
  jumpTo(value: unknown): void;
  panBy(value: unknown): void;
  on(event: string, handler: (event: unknown) => void): void;
  off(event: string, handler: (event: unknown) => void): void;
  once(event: string, handler: (event: unknown) => void): void;
  loaded(): boolean;
  isMoving(): boolean;
  remove(): void;
  readonly dragPan: { disable(): void; enable(): void };
  readonly boxZoom: { disable(): void };
  readonly doubleClickZoom: { disable(): void };
  readonly keyboard: { disable(): void };
}

export const fakeMap = { instance: null as FakeMap | null };

export const fakeManifest = {
  pipelineVersion: "test",
  areaOutlines: {
    datasetVersion: "test",
    edgeSemantics: "lonlat-linear",
    sourceSha256: "0".repeat(64),
    geometryCount: 0,
  },
  areaLabels: {
    datasetVersion: "test",
    sourceSha256: "0".repeat(64),
    count: 0,
    layer: "area_labels",
    stableIdentity: true,
    localizedText: "none",
    worstUnits: 0,
    boundUnits: 0,
  },
  zoom: { tileMin: 0, tileMax: 7, fitForPurposeMax: 7, overscaleMax: 12 },
  bounds: [-180, -85, 180, 85],
  tileExtent: 4096,
  layers: {
    land: "land",
    protected: "protected",
    areas: "areas",
    areaOutlines: "area_outlines",
    areaLabels: "area_labels",
    climate: "climate",
  },
  packSha256: "0123456789abcdef",
  packBytes: 0,
  attribution: "Natural Earth",
};

export class FakeMapClass implements FakeMap {
  readonly options: { readonly container: HTMLElement };
  readonly canvas: HTMLCanvasElement;
  markerHits: readonly { readonly properties: Record<string, unknown> }[] = [];
  areaHits: readonly { readonly properties: Record<string, unknown> }[] = [];
  readonly layoutCalls: { readonly id: string; readonly value: unknown }[] = [];
  readonly filterCalls: { readonly id: string; readonly value: unknown }[] = [];
  readonly dragPanCalls: string[] = [];
  readonly panByCalls: { readonly x: number; readonly y: number }[] = [];
  readonly panOptions: unknown[] = [];
  readonly projectionCalls: unknown[] = [];
  readonly bearingCalls: number[] = [];
  boxZoomDisabled = false;
  doubleClickZoomDisabled = false;
  keyboardDisabled = false;
  readonly handlers = new Map<string, ((event: unknown) => void)[]>();
  private centre = { lng: 0, lat: 30 };
  private zoom = 2;

  constructor(options: { readonly container: HTMLElement }) {
    this.options = options;
    this.canvas = document.createElement("canvas");
    options.container.appendChild(this.canvas);
    fakeMap.instance = this;
  }

  emit(event: string, payload: unknown): void {
    for (const handler of this.handlers.get(event) ?? []) handler(payload);
  }

  getCenter(): { readonly lng: number; readonly lat: number } {
    return this.centre;
  }
  getZoom(): number {
    return this.zoom;
  }
  getPitch(): number {
    return 0;
  }
  getBearing(): number {
    return 0;
  }
  getContainer(): HTMLElement {
    return this.options.container;
  }
  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }
  queryRenderedFeatures(
    _point: unknown,
    options?: { readonly layers?: readonly string[] },
  ): readonly { readonly properties: Record<string, unknown> }[] {
    const layers = options?.layers ?? [];
    if (layers.includes("adapter-markers")) return this.markerHits;
    if (layers.includes("areas-fill")) return this.areaHits;
    return [];
  }
  getSource(): { setData(data: unknown): void } {
    return { setData: () => undefined };
  }
  setLayoutProperty(id: string, _key: string, value: unknown): void {
    this.layoutCalls.push({ id, value });
  }
  setFilter(id: string, value: unknown): void {
    this.filterCalls.push({ id, value });
  }
  setPaintProperty(): void {}
  setProjection(value: unknown): void {
    this.projectionCalls.push(value);
  }
  setFeatureState(): void {}
  setCenter(value: { lng: number; lat: number }): void {
    this.centre = value;
  }
  setZoom(value: number): void {
    this.zoom = value;
  }
  setBearing(value: number): void {
    this.bearingCalls.push(value);
  }
  jumpTo(value: { center?: [number, number]; zoom?: number }): void {
    if (value.center !== undefined) this.centre = { lng: value.center[0], lat: value.center[1] };
    if (value.zoom !== undefined) this.zoom = value.zoom;
  }
  panBy(
    value: { readonly x?: number; readonly y?: number } | [number, number],
    options?: unknown,
  ): void {
    this.panOptions.push(options);
    if (Array.isArray(value)) this.panByCalls.push({ x: value[0], y: value[1] });
  }
  on(event: string, handler: (event: unknown) => void): void {
    const list = this.handlers.get(event) ?? [];
    list.push(handler);
    this.handlers.set(event, list);
  }
  off(event: string, handler: (event: unknown) => void): void {
    this.handlers.set(
      event,
      (this.handlers.get(event) ?? []).filter((candidate) => candidate !== handler),
    );
  }
  once(event: string, handler: (event: unknown) => void): void {
    queueMicrotask(() => handler(undefined));
    this.on(event, handler);
  }
  loaded(): boolean {
    return true;
  }
  isMoving(): boolean {
    return false;
  }
  remove(): void {}
  readonly dragPan = {
    disable: () => this.dragPanCalls.push("disable"),
    enable: () => this.dragPanCalls.push("enable"),
  };
  readonly boxZoom = {
    disable: () => {
      this.boxZoomDisabled = true;
    },
  };
  readonly doubleClickZoom = {
    disable: () => {
      this.doubleClickZoomDisabled = true;
    },
  };
  readonly keyboard = {
    disable: () => {
      this.keyboardDisabled = true;
    },
  };
}
