import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";

import { gateBaseCommit } from "../src/replay-approvals-chain-git.js";

const gitEnv = {
  ...process.env,
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_SYSTEM: "/dev/null",
  GIT_AUTHOR_DATE: "2026-01-01T00:00:00Z",
  GIT_COMMITTER_DATE: "2026-01-01T00:00:00Z",
  NODE_OPTIONS: "",
};

describe("gateBaseCommit", () => {
  let repo = "";
  const git = (...args: string[]): string =>
    execFileSync(
      "git",
      [
        "-C",
        repo,
        "-c",
        "user.name=t",
        "-c",
        "user.email=t@t",
        "-c",
        "commit.gpgsign=false",
        "-c",
        "core.hooksPath=/dev/null",
        ...args,
      ],
      { encoding: "utf8", env: gitEnv, stdio: ["ignore", "pipe", "pipe"] },
    );
  const commit = (file: string, message: string): string => {
    writeFileSync(join(repo, file), message);
    git("add", "-A");
    git("commit", "-q", "-m", message);
    return git("rev-parse", "HEAD").trim();
  };

  beforeAll(() => {
    repo = mkdtempSync(join(tmpdir(), "gate-base-"));
    git("init", "-q", "--initial-branch=dev");
    commit("shared.txt", "fork point");
    git("checkout", "-q", "-b", "feature");
    commit("feature.txt", "feature work");
    git("checkout", "-q", "dev");
    commit("dev.txt", "dev work");
  });

  afterAll(() => {
    rmSync(repo, { recursive: true, force: true });
  });

  it("is the fork point when the branch has not merged the base", () => {
    git("checkout", "-q", "feature");
    expect(gateBaseCommit(git, "dev")).toBe(git("rev-parse", "dev~1").trim());
  });

  it("is the base tip while a merge of the base is uncommitted", () => {
    git("checkout", "-q", "feature");
    git("merge", "--no-commit", "--no-ff", "dev");
    try {
      expect(gateBaseCommit(git, "dev")).toBe(git("rev-parse", "dev").trim());
    } finally {
      git("merge", "--abort");
    }
  });

  it("is the base tip after the merge commit, matching the in-merge answer", () => {
    git("checkout", "-q", "feature");
    git("merge", "--no-ff", "-m", "merge dev", "dev");
    expect(gateBaseCommit(git, "dev")).toBe(git("rev-parse", "dev").trim());
  });
});
