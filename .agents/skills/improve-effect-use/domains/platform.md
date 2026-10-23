# Platform

Docs: <https://effect.website/docs/v4/platform/introduction>, `file-system`, `path`, `terminal`, `runtime`, `platformlogger`. Sources: `vendor/effect/src/FileSystem.ts`, `Path.ts`, `Terminal.ts`, `Stdio.ts`, `PlatformError.ts`.

## Signals

- `node:fs`, `fs/promises`, `node:path`, `node:os`, `node:child_process`, `process.stdout`, `readline` inside Effect code.
- `path.join` / `path.resolve` building identifiers or hashed keys.
- `FileSystem.`, `Path.`, `Terminal.`, `ChildProcessSpawner`, `NodeRuntime`.
- File reads that feed a decoder without a typed failure.

## Idioms

- `FileSystem` and `Path` are services: read and write files, directories, and streams as Effects with a typed `PlatformError`; provide the Node implementation from `@effect/platform-node` at the edge.
- A service that touches files requires `FileSystem` (resolved in its layer) so tests provide an in-memory or temp-dir double; the docs show a mocked `FileSystem` layer.
- `Path` normalises separators; use it rather than string concatenation.
- `Terminal` and `Stdio` model stdin/stdout; `PlatformLogger.toFile` writes logs to a file.
- Child processes go through `ChildProcess` and `ChildProcessSpawner` from `effect/process` (see `vendor/effect/ai-docs/src/60_child-process`) so output is a typed `Stream`.
- The platform layer is provided once at the entrypoint, with `NodeRuntime.runMain`.

## Gaps

| Smell | Kind | Direction |
| --- | --- | --- |
| `fs.readFile` / `writeFile` inside an Effect | bypass | `FileSystem` service; failure is a typed `PlatformError` |
| Raw `path.join` with platform separators | leak | `Path` service, or posix-normalised segments |
| `child_process.spawn` with hand-wired streams | bypass | `ChildProcessSpawner` |
| Tests touching the real disk for one service | bypass | `FileSystem` double in a test layer |
| `process.stdout.write` in a CLI | bypass | `Terminal` |
| Listing a directory and using the order returned | leak | Sort explicitly with an `Order` |

## Project

Authoritative packages cannot read filesystem order, hostnames, platform path separators, or `process.*`. Platform code lives at edges (`persistence`, `content-compiler`, `apps/desktop/src/main`, `apps/compiler-cli`).
