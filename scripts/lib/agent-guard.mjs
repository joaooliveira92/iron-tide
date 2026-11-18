import { existsSync, readFileSync, statSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { resolve } from "node:path";

const INTERPRETERS = /^(python3?|node|perl|ruby)$/u;
const WRITE_SIGNATURES = [
  /\bopen\s*\([^)]*,\s*["'`][wax]/u,
  /\.write_text\s*\(/u,
  /\.write_bytes\s*\(/u,
  /\.write\s*\(/u,
  /\b(?:writeFileSync|appendFileSync|writeFile|appendFile)\b/u,
  /\bos\.(?:rename|replace|remove|unlink)\s*\(/u,
  /\bshutil\.(?:move|copy|copy2|copyfile|copytree|rmtree)\s*\(/u,
  /\b(?:createWriteStream|copyFileSync|copyFile|cpSync|renameSync|rmSync|unlinkSync|truncateSync)\s*\(/u,
  /\bPath\s*\([^)]*\)\s*\.(?:touch|unlink|rename|replace)\s*\(/u,
  /\bFile\s*\.\s*(?:write|binwrite|open|delete|rename)\b/u,
  /\bopen\s*\([^)]*["'`]\s*\+?\s*>/u,
];
const SOURCE_EXTENSIONS = /\.(?:tsx?|mts|cts|jsx?|mjs|cjs|json|md|ya?ml|css|html|sh|py)$/u;
const CONTENT_PROGRAMS = new Set(["echo", "printf", "cat", "sed", "awk", "tee"]);
const COPY_PROGRAMS = new Set(["cp", "mv", "install"]);
const NEXT_MUTATION =
  "The next mutation must use Edit (Write for a new file); do not retry via Bash, an interpreter, redirection, or an equivalent.";
const safeAlternativeRead = (policy) =>
  `Use the Read tool with offset/limit (at most ${policy.readRangeMaxLines} lines), or \`rg -n -C3 <pattern> <path> | head -${policy.readRangeMaxLines}\`.`;

const REDIRECT = /^(\d*)(>>?)(.*)$/u;
const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");

export function tokenizeCommand(command) {
  const segments = [];
  let current = { words: [], redirects: [], heredocs: [], pipedOut: false };
  let word = "";
  let hasWord = false;
  let pendingRedirect = null;
  const pendingHeredocs = [];

  const pushWord = () => {
    if (!hasWord) return;
    const redirect = REDIRECT.exec(word);
    if (pendingRedirect !== null) {
      current.redirects.push({ ...pendingRedirect, target: word });
      pendingRedirect = null;
    } else if (redirect !== null && redirect[3] === "") {
      pendingRedirect = { fd: redirect[1], op: redirect[2] };
    } else if (redirect !== null) {
      current.redirects.push({ fd: redirect[1], op: redirect[2], target: redirect[3] });
    } else {
      current.words.push(word);
    }
    word = "";
    hasWord = false;
  };
  const endSegment = (pipedOut) => {
    pushWord();
    current.pipedOut = pipedOut;
    if (current.words.length > 0 || current.redirects.length > 0) segments.push(current);
    current = { words: [], redirects: [], heredocs: [], pipedOut: false };
  };

  let i = 0;
  const n = command.length;
  while (i < n) {
    const ch = command[i];
    if (ch === "#" && !hasWord && pendingRedirect === null) {
      const eol = command.indexOf("\n", i);
      i = eol === -1 ? n : eol;
      continue;
    }
    if (ch === "\\" && i + 1 < n) {
      word += command[i + 1];
      hasWord = true;
      i += 2;
      continue;
    }
    if (ch === "'") {
      const end = command.indexOf("'", i + 1);
      const stop = end === -1 ? n : end;
      word += command.slice(i + 1, stop);
      hasWord = true;
      i = stop + 1;
      continue;
    }
    if (ch === '"') {
      let j = i + 1;
      while (j < n && command[j] !== '"') {
        if (command[j] === "\\" && j + 1 < n) j += 1;
        word += command[j];
        j += 1;
      }
      hasWord = true;
      i = j + 1;
      continue;
    }
    if (ch === "<" && command[i + 1] === "<" && command[i + 2] !== "<") {
      pushWord();
      let j = i + 2;
      const dash = command[j] === "-";
      if (dash) j += 1;
      while (command[j] === " " || command[j] === "\t") j += 1;
      let delimiter = "";
      while (j < n && !/[\s;&|<>]/u.test(command[j])) {
        if (command[j] === "'" || command[j] === '"') {
          const quote = command[j];
          const end = command.indexOf(quote, j + 1);
          const stop = end === -1 ? n : end;
          delimiter += command.slice(j + 1, stop);
          j = stop + 1;
        } else {
          delimiter += command[j];
          j += 1;
        }
      }
      const heredoc = { delimiter, dash, body: "" };
      current.heredocs.push(heredoc);
      pendingHeredocs.push(heredoc);
      i = j;
      continue;
    }
    if (ch === "\n") {
      endSegment(false);
      i += 1;
      for (const heredoc of pendingHeredocs.splice(0)) {
        const lines = [];
        while (i < n) {
          let eol = command.indexOf("\n", i);
          if (eol === -1) eol = n;
          const line = command.slice(i, eol);
          i = Math.min(eol + 1, n);
          const probe = heredoc.dash ? line.replace(/^\t+/u, "") : line;
          if (probe === heredoc.delimiter) break;
          lines.push(line);
        }
        heredoc.body = lines.join("\n");
      }
      continue;
    }
    if (ch === "&" && command[i + 1] === "&") {
      endSegment(false);
      i += 2;
      continue;
    }
    if (ch === "|") {
      const doubled = command[i + 1] === "|";
      endSegment(!doubled);
      i += doubled ? 2 : 1;
      continue;
    }
    if (ch === "&" && (word.endsWith(">") || command[i + 1] === ">")) {
      word += ch;
      hasWord = true;
      i += 1;
      continue;
    }
    if (ch === ";" || ch === "&") {
      endSegment(false);
      i += 1;
      continue;
    }
    if (ch === " " || ch === "\t") {
      pushWord();
      i += 1;
      continue;
    }
    word += ch;
    hasWord = true;
    i += 1;
  }
  endSegment(false);
  return segments;
}

export function parseOverride(command, policy) {
  const pattern = new RegExp(`#\\s*${escapeRegExp(policy.overrideToken)}\\s+(\\S[^\\n]*)`, "u");
  const match = pattern.exec(command);
  if (match === null) return null;
  const reason = match[1].trim();
  return reason.length >= policy.overrideMinReasonChars ? { reason } : null;
}

export function createNodeFs() {
  return {
    exists: (path) => existsSync(path),
    lineCount: (path, maxBytes) => {
      try {
        const info = statSync(path);
        if (!info.isFile()) return null;
        if (info.size > maxBytes) return Number.POSITIVE_INFINITY;
        const text = readFileSync(path, "utf8");
        if (text.length === 0) return 0;
        let count = 0;
        for (let k = 0; k < text.length; k += 1) if (text.charCodeAt(k) === 10) count += 1;
        return text.endsWith("\n") ? count : count + 1;
      } catch {
        return null;
      }
    },
  };
}

function expandHome(path) {
  if (path === "~") return homedir();
  if (path.startsWith("~/")) return resolve(homedir(), path.slice(2));
  return path;
}

export function resolvePath(base, path) {
  const expanded = expandHome(path);
  return resolve(base, expanded);
}

export const hasDynamicText = (text) => /[$`*?[{]/u.test(text);

const isScratchPath = (path) => {
  const scratch = tmpdir();
  return (
    path.startsWith("/tmp/") ||
    path.startsWith("/private/tmp/") ||
    path.startsWith(`${scratch}/`) ||
    path.startsWith("/dev/")
  );
};

function scriptText(segment) {
  const parts = segment.heredocs.map((heredoc) => heredoc.body);
  const flagIndex = segment.words.findIndex((w) => w === "-c" || w === "-e" || w === "-p");
  if (flagIndex !== -1 && segment.words[flagIndex + 1] !== undefined) {
    parts.push(segment.words[flagIndex + 1]);
  }
  return parts.join("\n");
}

const stdoutRedirects = (segment) =>
  segment.redirects.filter((r) => (r.fd === "" || r.fd === "1") && !r.target.startsWith("&"));

function hasSedInPlace(words) {
  return words.slice(1).some((w) => w === "--in-place" || /^-(?!-)[A-Za-z]*i/u.test(w));
}

const hasPerlInPlace = (words) => words.slice(1).some((w) => /^-[nplas0-9]*i/u.test(w));

function isSourceTarget(destination, workdir, workdirKnown) {
  if (hasDynamicText(destination) || !SOURCE_EXTENSIONS.test(destination)) return false;
  const relative = !destination.startsWith("/") && !destination.startsWith("~");
  if (relative && !workdirKnown) return false;
  const absolute = resolvePath(workdir, destination);
  return !isScratchPath(absolute) && !/\/\.git\//u.test(absolute);
}

function redirectedSourceTarget(segment, workdir, workdirKnown) {
  const program = segment.words[0];
  if (!CONTENT_PROGRAMS.has(program)) return undefined;
  const targets = stdoutRedirects(segment).map((r) => r.target);
  if (program === "tee") {
    targets.push(...segment.words.slice(1).filter((w) => !w.startsWith("-")));
  }
  return targets.find((target) => isSourceTarget(target, workdir, workdirKnown));
}

function copiedSourceTarget(segment, workdir, workdirKnown) {
  if (!COPY_PROGRAMS.has(segment.words[0])) return undefined;
  const operands = segment.words.slice(1).filter((w) => !w.startsWith("-"));
  if (operands.length < 2) return undefined;
  const destination = operands[operands.length - 1];
  return isSourceTarget(destination, workdir, workdirKnown) ? destination : undefined;
}

export function evaluateBashCommand({ command, cwd, policy, fsApi = createNodeFs() }) {
  const override = parseOverride(command, policy);
  const segments = tokenizeCommand(command);
  let workdir = cwd;
  let workdirKnown = typeof cwd === "string" && cwd.length > 0;
  const blocks = [];

  for (const segment of segments) {
    const [program] = segment.words;
    if (program === "cd" && segment.words.length >= 2 && !segment.pipedOut) {
      const target = segment.words[1];
      if (!workdirKnown || target === "-" || hasDynamicText(target)) {
        workdirKnown = false;
      } else {
        workdir = resolvePath(workdir, target);
      }
      continue;
    }
    if (program === "sed" && hasSedInPlace(segment.words)) {
      blocks.push({
        rule: "sed-in-place",
        message: "sed -i rewrites files in place.",
        mutation: true,
      });
      continue;
    }
    if (program === "perl" && hasPerlInPlace(segment.words)) {
      blocks.push({
        rule: "perl-in-place",
        message: "perl -i rewrites files in place.",
        mutation: true,
      });
      continue;
    }
    if (INTERPRETERS.test(program ?? "") || /^python3?$/u.test((program ?? "").split("/").pop())) {
      const text = scriptText(segment);
      if (text.length > 0 && WRITE_SIGNATURES.some((signature) => signature.test(text))) {
        blocks.push({
          rule: "script-write",
          message: "An interpreter script writes files. Read-only scripts are allowed.",
          mutation: true,
        });
        continue;
      }
    }
    if ((program === "cat" || program === "tee") && segment.heredocs.length > 0) {
      const target = stdoutRedirects(segment)[0]?.target;
      const teeTarget =
        program === "tee" ? segment.words.find((w, k) => k > 0 && !w.startsWith("-")) : undefined;
      const destination = target ?? teeTarget;
      if (destination !== undefined && workdirKnown && !hasDynamicText(destination)) {
        const absolute = resolvePath(workdir, destination);
        if (!isScratchPath(absolute) && fsApi.exists(absolute)) {
          blocks.push({
            rule: "heredoc-overwrite",
            message: `A heredoc would overwrite the existing file ${destination}.`,
            mutation: true,
          });
          continue;
        }
      }
      continue;
    }
    const redirected = redirectedSourceTarget(segment, workdir, workdirKnown);
    if (redirected !== undefined) {
      blocks.push({
        rule: "redirect-write",
        message: `${program} writes the source file ${redirected}.`,
        mutation: true,
      });
      continue;
    }
    const copied = copiedSourceTarget(segment, workdir, workdirKnown);
    if (copied !== undefined) {
      blocks.push({
        rule: "copy-write",
        message: `${program} writes the source file ${copied}.`,
        mutation: true,
      });
      continue;
    }
    if (program === "cat" && !segment.pipedOut && stdoutRedirects(segment).length === 0) {
      const operands = segment.words.slice(1).filter((w) => !w.startsWith("-") || w === "-");
      if (operands.length === 0 || operands.includes("-") || !workdirKnown) continue;
      if (operands.some(hasDynamicText)) continue;
      let total = 0;
      let known = true;
      for (const operand of operands) {
        const lines = fsApi.lineCount(
          resolvePath(workdir, operand),
          policy.maxFileBytesForLineCount,
        );
        if (lines === null) {
          known = false;
          break;
        }
        total += lines;
      }
      if (known && total > policy.catMaxLines) {
        const shown = Number.isFinite(total)
          ? String(total)
          : `>${policy.maxFileBytesForLineCount} bytes`;
        blocks.push({
          rule: "cat-dump",
          message: `cat would dump ${shown} lines (limit ${policy.catMaxLines}). ${safeAlternativeRead(policy)}`,
        });
      }
    }
  }

  if (blocks.length === 0) {
    return { decision: "allow", rule: null, message: "", override: null, mutation: false };
  }
  const first = blocks[0];
  const mutation = first.mutation === true;
  const message = mutation ? `${first.message} ${NEXT_MUTATION}` : first.message;
  if (override !== null) {
    return { decision: "allow", rule: first.rule, message, override, mutation };
  }
  const hint = mutation
    ? ""
    : ` Override (audited): append \`# ${policy.overrideToken} <reason>\` to the command.`;
  return {
    decision: "block",
    rule: first.rule,
    message: `${message}${hint}`,
    override: null,
    mutation,
  };
}
