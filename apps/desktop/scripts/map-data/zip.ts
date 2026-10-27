import { crc32, inflateRawSync } from "node:zlib";

import { MapDataError } from "./errors.ts";

const END_OF_CENTRAL_DIRECTORY = 0x06054b50;
const CENTRAL_DIRECTORY_ENTRY = 0x02014b50;
const LOCAL_FILE_HEADER = 0x04034b50;

export function readZip(bytes: Uint8Array): ReadonlyMap<string, Uint8Array> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let index = bytes.length - 22; index >= Math.max(0, bytes.length - 65557); index--) {
    if (view.getUint32(index, true) === END_OF_CENTRAL_DIRECTORY) {
      end = index;
      break;
    }
  }
  if (end < 0) throw new MapDataError("zip: end of central directory not found");
  const count = view.getUint16(end + 10, true);
  let cursor = view.getUint32(end + 16, true);
  const entries = new Map<string, Uint8Array>();
  for (let item = 0; item < count; item++) {
    if (view.getUint32(cursor, true) !== CENTRAL_DIRECTORY_ENTRY) {
      throw new MapDataError("zip: malformed central directory");
    }
    const method = view.getUint16(cursor + 10, true);
    const expectedCrc = view.getUint32(cursor + 16, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const size = view.getUint32(cursor + 24, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const localOffset = view.getUint32(cursor + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength));
    cursor += 46 + nameLength + extraLength + commentLength;
    if (view.getUint32(localOffset, true) !== LOCAL_FILE_HEADER) {
      throw new MapDataError(`zip: bad local header for ${name}`);
    }
    const dataStart =
      localOffset +
      30 +
      view.getUint16(localOffset + 26, true) +
      view.getUint16(localOffset + 28, true);
    const raw = bytes.subarray(dataStart, dataStart + compressedSize);
    let data: Uint8Array;
    if (method === 0) data = raw;
    else if (method === 8) data = new Uint8Array(inflateRawSync(raw));
    else throw new MapDataError(`zip: unsupported compression method ${method} for ${name}`);
    if (data.length !== size) throw new MapDataError(`zip: size mismatch for ${name}`);
    if (crc32(data) !== expectedCrc) throw new MapDataError(`zip: checksum mismatch for ${name}`);
    entries.set(name, data);
  }
  return new Map([...entries].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}
