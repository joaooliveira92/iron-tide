declare module "@mapbox/vector-tile" {
  import type Protobuf from "pbf";

  export interface VectorTilePoint {
    readonly x: number;
    readonly y: number;
  }

  export interface VectorTileFeature {
    readonly type: number;
    readonly properties: Record<string, unknown>;
    loadGeometry(): VectorTilePoint[][];
  }

  export interface VectorTileLayer {
    readonly extent: number;
    readonly length: number;
    feature(index: number): VectorTileFeature;
  }

  export class VectorTile {
    constructor(pbf: Protobuf);
    readonly layers: Record<string, VectorTileLayer | undefined>;
  }
}
