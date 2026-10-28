import { closeSync, openSync, readSync } from "node:fs";

import { PackageGuardInputError } from "./errors.ts";

export interface AsarEntry {
  readonly path: string;
  readonly size: number;
  readonly offset: number;
  readonly unpacked: boolean;
}

export interface AsarArchive {
  readonly entries: readonly AsarEntry[];
  readonly dataStart: number;
  readonly file: string;
}

interface HeaderNode {
  readonly files?: Record<string, HeaderNode>;
  readonly size?: number;
  readonly offset?: string;
  readonly unpacked?: boolean;
  readonly link?: string;
}

function readExactly(fd: number, length: number, position: number, label: string): Buffer {
  const buffer = Buffer.alloc(length);
  let done = 0;
  while (done < length) {
    const count = readSync(fd, buffer, done, length - done, position + done);
    if (count === 0) throw new PackageGuardInputError(`${label}: archive is truncated`);
    done += count;
  }
  return buffer;
}

export function readAsar(file: string): AsarArchive {
  let fd: number;
  try {
    fd = openSync(file, "r");
  } catch (error) {
    throw new PackageGuardInputError(
      `archive cannot be opened: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  try {
    const prefix = readExactly(fd, 16, 0, "header");
    if (prefix.readUInt32LE(0) !== 4) {
      throw new PackageGuardInputError("archive is not an asar file: bad header marker");
    }
    const headerSize = prefix.readUInt32LE(4);
    const jsonLength = prefix.readUInt32LE(12);
    if (jsonLength + 8 > headerSize) {
      throw new PackageGuardInputError("archive header sizes are inconsistent");
    }
    const json = readExactly(fd, jsonLength, 16, "header").toString("utf8");
    let root: HeaderNode;
    try {
      root = JSON.parse(json) as HeaderNode;
    } catch {
      throw new PackageGuardInputError("archive header is not valid JSON");
    }
    const entries: AsarEntry[] = [];
    const walk = (node: HeaderNode, prefixPath: string): void => {
      for (const name of Object.keys(node.files ?? {}).sort()) {
        const child = (node.files as Record<string, HeaderNode>)[name] as HeaderNode;
        const path = prefixPath === "" ? name : `${prefixPath}/${name}`;
        if (child.files !== undefined) walk(child, path);
        else if (child.link === undefined) {
          entries.push({
            path,
            size: child.size ?? 0,
            offset: child.unpacked === true ? 0 : Number(child.offset ?? "0"),
            unpacked: child.unpacked === true,
          });
        } else {
          entries.push({ path, size: 0, offset: 0, unpacked: false });
        }
      }
    };
    walk(root, "");
    return { entries, dataStart: 8 + headerSize, file };
  } finally {
    closeSync(fd);
  }
}

export function readAsarFile(archive: AsarArchive, entry: AsarEntry): Buffer {
  const fd = openSync(archive.file, "r");
  try {
    return readExactly(fd, entry.size, archive.dataStart + entry.offset, entry.path);
  } finally {
    closeSync(fd);
  }
}

export function encodeAsar(files: ReadonlyMap<string, Uint8Array>): Buffer {
  const root: { files: Record<string, unknown> } = { files: {} };
  const ordered = [...files.keys()].sort();
  let offset = 0;
  for (const path of ordered) {
    const parts = path.split("/");
    let node = root;
    for (const part of parts.slice(0, -1)) {
      const next = (node.files[part] ?? { files: {} }) as { files: Record<string, unknown> };
      node.files[part] = next;
      node = next;
    }
    const size = (files.get(path) as Uint8Array).length;
    node.files[parts[parts.length - 1] as string] = { size, offset: String(offset) };
    offset += size;
  }
  const json = Buffer.from(JSON.stringify(root), "utf8");
  const payload = 4 + json.length;
  const padded = payload + ((4 - (payload % 4)) % 4);
  const header = Buffer.alloc(16 + padded - 4);
  header.writeUInt32LE(4, 0);
  header.writeUInt32LE(padded + 4, 4);
  header.writeUInt32LE(padded, 8);
  header.writeUInt32LE(json.length, 12);
  json.copy(header, 16);
  return Buffer.concat([
    header,
    ...ordered.map((path) => Buffer.from(files.get(path) as Uint8Array)),
  ]);
}
