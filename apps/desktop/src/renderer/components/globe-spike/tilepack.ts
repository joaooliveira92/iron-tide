export const TILEPACK_FORMAT = "bluewave-tilepack-1";
export const TILEPACK_MAGIC = "BWTP1\u0000\u0000\u0000";
const HEADER_BYTES = 16;
const ENTRY_BYTES = 24;

export class TilePackError extends Error {
  readonly _tag = "TilePackError";
  readonly reason: "truncated" | "magic" | "version" | "bounds" | "order" | "crc";
  constructor(reason: TilePackError["reason"], message: string) {
    super(message);
    this.reason = reason;
  }
}

export interface TilePackTile {
  readonly z: number;
  readonly x: number;
  readonly y: number;
  readonly data: Uint8Array;
}

export interface TilePackEntry {
  readonly z: number;
  readonly x: number;
  readonly y: number;
  readonly offset: number;
  readonly length: number;
  readonly crc32: number;
}

const CRC_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = (CRC_TABLE[(crc ^ byte) & 0xff] as number) ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function tileKey(z: number, x: number, y: number): number {
  return (z * 65536 + x) * 65536 + y;
}

export function encodeTilePack(tiles: readonly TilePackTile[]): Uint8Array {
  const sorted = [...tiles].sort((a, b) => tileKey(a.z, a.x, a.y) - tileKey(b.z, b.x, b.y));
  for (let index = 1; index < sorted.length; index++) {
    const previous = sorted[index - 1] as TilePackTile;
    const current = sorted[index] as TilePackTile;
    if (tileKey(previous.z, previous.x, previous.y) === tileKey(current.z, current.x, current.y)) {
      throw new TilePackError("order", `duplicate tile ${current.z}/${current.x}/${current.y}`);
    }
  }
  const dataBytes = sorted.reduce((sum, tile) => sum + tile.data.length, 0);
  const out = new Uint8Array(HEADER_BYTES + sorted.length * ENTRY_BYTES + dataBytes);
  const view = new DataView(out.buffer);
  for (let index = 0; index < TILEPACK_MAGIC.length; index++) {
    out[index] = TILEPACK_MAGIC.charCodeAt(index);
  }
  view.setUint32(8, 1, true);
  view.setUint32(12, sorted.length, true);
  let offset = 0;
  const dataStart = HEADER_BYTES + sorted.length * ENTRY_BYTES;
  sorted.forEach((tile, index) => {
    const base = HEADER_BYTES + index * ENTRY_BYTES;
    view.setUint8(base, tile.z);
    view.setUint32(base + 4, tile.x, true);
    view.setUint32(base + 8, tile.y, true);
    view.setUint32(base + 12, offset, true);
    view.setUint32(base + 16, tile.data.length, true);
    view.setUint32(base + 20, crc32(tile.data), true);
    out.set(tile.data, dataStart + offset);
    offset += tile.data.length;
  });
  return out;
}

export class TilePack {
  private readonly bytes: Uint8Array;
  private readonly view: DataView;
  readonly count: number;
  private readonly dataStart: number;

  private constructor(bytes: Uint8Array, count: number) {
    this.bytes = bytes;
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    this.count = count;
    this.dataStart = HEADER_BYTES + count * ENTRY_BYTES;
  }

  static parse(bytes: Uint8Array): TilePack {
    if (bytes.length < HEADER_BYTES) throw new TilePackError("truncated", "header is truncated");
    for (let index = 0; index < TILEPACK_MAGIC.length; index++) {
      if (bytes[index] !== TILEPACK_MAGIC.charCodeAt(index)) {
        throw new TilePackError("magic", "not a Bluewave tile pack");
      }
    }
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (view.getUint32(8, true) !== 1) throw new TilePackError("version", "unsupported version");
    const count = view.getUint32(12, true);
    const dataStart = HEADER_BYTES + count * ENTRY_BYTES;
    if (bytes.length < dataStart) throw new TilePackError("truncated", "index is truncated");
    const pack = new TilePack(bytes, count);
    const last = count === 0 ? null : pack.entryAt(count - 1);
    if (last !== null && dataStart + last.offset + last.length > bytes.length) {
      throw new TilePackError("truncated", "tile data is truncated");
    }
    return pack;
  }

  entryAt(index: number): TilePackEntry {
    const base = HEADER_BYTES + index * ENTRY_BYTES;
    return {
      z: this.view.getUint8(base),
      x: this.view.getUint32(base + 4, true),
      y: this.view.getUint32(base + 8, true),
      offset: this.view.getUint32(base + 12, true),
      length: this.view.getUint32(base + 16, true),
      crc32: this.view.getUint32(base + 20, true),
    };
  }

  find(z: number, x: number, y: number): TilePackEntry | null {
    const wanted = tileKey(z, x, y);
    let low = 0;
    let high = this.count - 1;
    while (low <= high) {
      const middle = (low + high) >> 1;
      const entry = this.entryAt(middle);
      const key = tileKey(entry.z, entry.x, entry.y);
      if (key === wanted) return entry;
      if (key < wanted) low = middle + 1;
      else high = middle - 1;
    }
    return null;
  }

  read(entry: TilePackEntry): Uint8Array {
    const start = this.dataStart + entry.offset;
    const end = start + entry.length;
    if (end > this.bytes.length) {
      throw new TilePackError("bounds", `tile ${entry.z}/${entry.x}/${entry.y} exceeds the pack`);
    }
    const data = this.bytes.subarray(start, end);
    if (crc32(data) !== entry.crc32) {
      throw new TilePackError("crc", `tile ${entry.z}/${entry.x}/${entry.y} failed its checksum`);
    }
    return data;
  }

  get(z: number, x: number, y: number): Uint8Array | null {
    const entry = this.find(z, x, y);
    return entry === null ? null : this.read(entry);
  }

  *entries(): Generator<TilePackEntry> {
    for (let index = 0; index < this.count; index++) yield this.entryAt(index);
  }
}
