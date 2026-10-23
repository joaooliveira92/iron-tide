const { execFileSync } = require("child_process");
const { readFileSync, writeFileSync } = require("fs");
const path = require("path");

/**
 * Compare the observed hashes with the committed golden reference in both
 * directions, so a key that is missing, extra or different is a problem.
 * @param {Record<string, string>} actual
 * @param {Record<string, string>} golden
 * @returns {string[]}
 */
function compareHashes(actual, golden) {
  const problems = [];
  for (const key of Object.keys(golden)) {
    if (!Object.hasOwn(actual, key)) {
      problems.push("MISSING: " + key + " golden=" + golden[key]);
    } else if (actual[key] !== golden[key]) {
      problems.push("MISMATCH: " + key + " actual=" + actual[key] + " golden=" + golden[key]);
    }
  }
  for (const key of Object.keys(actual)) {
    if (!Object.hasOwn(golden, key)) {
      problems.push("EXTRA: " + key + " actual=" + actual[key]);
    }
  }
  return problems;
}

module.exports = { compareHashes };

if (require.main === module) {
  const childScript = path.resolve(
    __dirname,
    "..",
    "packages",
    "cross-process-test",
    "dist",
    "run-child.js",
  );
  const goldenPath = path.resolve(__dirname, "..", "golden", "hashes.json");

  const stdout = execFileSync(process.execPath, [childScript], {
    encoding: "utf8",
    timeout: 30000,
  });
  const lines = stdout.trim().split("\n");
  const actual = JSON.parse(lines[lines.length - 1]);
  const golden = JSON.parse(readFileSync(goldenPath, "utf8"));

  const outIndex = process.argv.indexOf("--write-observed");
  if (outIndex !== -1) {
    writeFileSync(process.argv[outIndex + 1], JSON.stringify(actual, null, 2) + "\n", "utf8");
  }

  const problems = compareHashes(actual, golden);
  if (problems.length === 0) {
    console.log("All " + Object.keys(golden).length + " hashes match golden reference");
  } else {
    for (const problem of problems) console.error(problem);
    process.exit(1);
  }
}
