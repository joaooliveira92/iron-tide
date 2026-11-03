#!/usr/bin/env node
import { spawn } from "node:child_process";
import { closeSync, mkdirSync, openSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";

import { isEntryPoint } from "./lib/paths.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const POLICY_PATH = join(ROOT, "scripts/data/agent-context-policy.json");
const USAGE = "usage: run-quiet.mjs [--log <file>] -- <command> [args...]";

export function logPathFor(policy, command, explicit) {
  if (explicit !== undefined)
    return isAbsolute(explicit) ? explicit : resolve(process.cwd(), explicit);
  const name = command
    .join("-")
    .replace(/[^A-Za-z0-9._-]+/gu, "_")
    .slice(0, 80);
  return join(ROOT, policy.quietLogDir, `${name}.log`);
}

export function tailLines(text, count) {
  const lines = text.split("\n");
  if (lines.at(-1) === "") lines.pop();
  return lines.slice(-count);
}

export function parseArgv(argv) {
  const separator = argv.indexOf("--");
  if (separator === -1 || separator === argv.length - 1) return { error: USAGE };
  const options = argv.slice(0, separator);
  let log;
  for (let i = 0; i < options.length; i += 1) {
    if (options[i] === "--log" && options[i + 1] !== undefined) {
      log = options[i + 1];
      i += 1;
    } else {
      return { error: USAGE };
    }
  }
  return { log, command: argv.slice(separator + 1) };
}

export function runQuiet(argv, policy, io = { out: process.stdout, err: process.stderr }) {
  const parsed = parseArgv(argv);
  if (parsed.error) {
    io.err.write(`${parsed.error}\n`);
    return Promise.resolve(2);
  }
  const logPath = logPathFor(policy, parsed.command, parsed.log);
  mkdirSync(dirname(logPath), { recursive: true });
  const fd = openSync(logPath, "w");
  const label = parsed.command.join(" ");
  return new Promise((resolveExit) => {
    const child = spawn(parsed.command[0], parsed.command.slice(1), {
      cwd: process.cwd(),
      stdio: ["ignore", fd, fd],
    });
    let settled = false;
    const forward = (signal) => child.kill(signal);
    for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, forward);
    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      closeSync(fd);
      io.err.write(`FAILED to start: ${label}: ${error.message}\n`);
      resolveExit(127);
    });
    child.on("close", (code, signal) => {
      if (settled) return;
      settled = true;
      closeSync(fd);
      const exit = code ?? (signal === null ? 1 : 128);
      if (exit === 0) {
        io.out.write(`ok: ${label} (log: ${logPath})\n`);
      } else {
        const tail = tailLines(readFileSync(logPath, "utf8"), policy.quietFailTailLines);
        io.err.write(`FAILED (exit ${exit}): ${label}\n${tail.join("\n")}\nfull log: ${logPath}\n`);
      }
      resolveExit(exit);
    });
  });
}

if (isEntryPoint(import.meta.url)) {
  const policy = JSON.parse(readFileSync(POLICY_PATH, "utf8"));
  process.exitCode = await runQuiet(process.argv.slice(2), policy);
}
