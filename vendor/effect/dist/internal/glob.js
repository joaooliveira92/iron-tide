import * as Arr from "../Array.js";
import * as Deferred from "../Deferred.js";
import * as Effect from "../Effect.js";
import * as Fiber from "../Fiber.js";
import * as Order from "../Order.js";
import * as Predicate from "../Predicate.js";
// -----------------------------------------------------------------------------
// compilation
// -----------------------------------------------------------------------------
const maxExpansions = 10_000;
const maxExpandedLength = 2 ** 22;
const maxBraceDepth = 64;
/** @internal */
export const compile = (patterns, dot) => {
  const nodes = [];
  const starts = new Set();
  for (const pattern of patterns) {
    for (const expanded of expandBraces(pattern)) {
      const start = nodes.length;
      if (compilePattern(expanded, nodes)) {
        starts.add(start);
      }
    }
  }
  const initial = closure(nodes, starts);
  return {
    nodes,
    initial,
    dot,
    masks: nodes.length <= 32 ? compileMasks(nodes, initial) : undefined
  };
};
const compileMasks = (nodes, initial) => {
  let start = 0;
  for (const state of initial) {
    start |= 1 << state;
  }
  let globstar = 0;
  let end = 0;
  let endFile = 0;
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const bit = 1 << i;
    if (node._tag === "Globstar") {
      globstar |= bit;
    } else if (node._tag === "End") {
      end |= bit;
      if (!node.directoryOnly) {
        endFile |= bit;
      }
    }
  }
  return {
    initial: start,
    globstar,
    end,
    endFile
  };
};
// Reject UNC paths rather than collapsing them into local absolute paths.
const isUnc = path => path.startsWith("//") && path[2] !== undefined && path[2] !== "/";
// Appends the pattern's nodes, or appends nothing when it can match no path
const compilePattern = (pattern, nodes) => {
  if (pattern === "" || isUnc(pattern)) {
    return false;
  }
  const raw = splitSegments(pattern);
  const globstar = raw.indexOf("**");
  if (globstar !== -1 && raw.some((segment, i) => i > globstar && (segment === "." || segment === ".."))) {
    return false;
  }
  const {
    directory,
    segments
  } = normalize(raw);
  if (segments.length === 0) {
    return false;
  }
  for (const segment of segments) {
    if (segment !== "**") {
      nodes.push(compileSegment(Array.from(segment)));
    } else if (nodes[nodes.length - 1] !== globstarNode) {
      nodes.push(globstarNode);
    }
  }
  nodes.push({
    _tag: "End",
    directoryOnly: directory
  });
  return true;
};
const globstarNode = {
  _tag: "Globstar"
};
const splitSegments = pattern => {
  const segments = [];
  let start = 0;
  for (let i = 0; i < pattern.length; i++) {
    if (pattern[i] === "\\") {
      i++;
    } else if (pattern[i] === "/") {
      segments.push(pattern.slice(start, i));
      start = i + 1;
    }
  }
  segments.push(pattern.slice(start));
  return segments;
};
const drive = /^[A-Za-z]:/;
const isDrive = segment => segment.length === 2 && drive.test(segment);
// the root of an absolute path: `""` or a drive such as `C:/`
const isRoot = name => name === "" || name.length === 3 && name[2] === "/" && drive.test(name);
const isAbsolute = path => path.startsWith("/") || path[2] === "/" && drive.test(path);
// Preserve absolute roots and a lone `.`; trailing `/` or `/.` marks a directory.
const normalize = raw => {
  const segments = [];
  let i = 0;
  if (raw.length > 1 && (raw[0] === "" || isDrive(raw[0]))) {
    segments.push(raw[0] === "" ? "" : `${raw[0]}/`);
    i = 1;
  }
  let directory = false;
  for (; i < raw.length; i++) {
    const segment = raw[i];
    if (segment === "" || segment === ".") {
      directory = i === raw.length - 1 && segments.length > 0;
    } else {
      segments.push(segment);
      directory = false;
    }
  }
  if (segments.length === 0 && raw.includes(".")) {
    segments.push(".");
  }
  return {
    segments,
    directory
  };
};
const compileSegment = chars => {
  const tokens = [];
  let literal = "";
  let magic = false;
  // once a class fails to close, every later `[` in the segment is literal
  let classes = true;
  for (let i = 0; i < chars.length; i++) {
    const char = chars[i];
    if (char === "\\" && i + 1 < chars.length) {
      literal += chars[++i];
      tokens.push({
        _tag: "Char",
        code: chars[i].codePointAt(0)
      });
    } else if (char === "*") {
      magic = true;
      if (tokens[tokens.length - 1]?._tag !== "Star") {
        tokens.push({
          _tag: "Star"
        });
      }
    } else if (char === "?") {
      magic = true;
      tokens.push({
        _tag: "Any"
      });
    } else if (char === "[" && classes) {
      const parsed = parseClass(chars, i);
      if (parsed === undefined) {
        classes = false;
        literal += char;
        tokens.push({
          _tag: "Char",
          code: char.codePointAt(0)
        });
      } else {
        magic = true;
        tokens.push(parsed.token);
        i = parsed.end;
      }
    } else {
      literal += char;
      tokens.push({
        _tag: "Char",
        code: char.codePointAt(0)
      });
    }
  }
  if (!magic) {
    return {
      _tag: "Literal",
      value: literal
    };
  }
  const first = tokens[0];
  return {
    _tag: "Wildcard",
    tokens,
    leadingDot: first._tag === "Char" && first.code === 0x2e,
    affixes: compileAffixes(tokens)
  };
};
// Lone surrogates stay on the token path: `startsWith` would match them
// against half of a surrogate pair.
const compileAffixes = tokens => {
  let prefix = "";
  let suffix;
  for (const token of tokens) {
    if (token._tag === "Star" && suffix === undefined) {
      suffix = "";
    } else if (token._tag === "Char" && (token.code < 0xd800 || token.code > 0xdfff)) {
      const char = String.fromCodePoint(token.code);
      if (suffix === undefined) {
        prefix += char;
      } else {
        suffix += char;
      }
    } else {
      return undefined;
    }
  }
  return suffix === undefined ? undefined : {
    prefix,
    suffix
  };
};
const range = (from, to) => [from.codePointAt(0), to.codePointAt(0)];
const posixClasses = {
  alnum: [... /*#__PURE__*/range("0", "9"), ... /*#__PURE__*/range("A", "Z"), ... /*#__PURE__*/range("a", "z")],
  alpha: [... /*#__PURE__*/range("A", "Z"), ... /*#__PURE__*/range("a", "z")],
  blank: [0x09, 0x09, 0x20, 0x20],
  cntrl: [0x00, 0x1f, 0x7f, 0x7f],
  digit: /*#__PURE__*/range("0", "9"),
  graph: [0x21, 0x7e],
  lower: /*#__PURE__*/range("a", "z"),
  print: [0x20, 0x7e],
  punct: [0x21, 0x2f, 0x3a, 0x40, 0x5b, 0x60, 0x7b, 0x7e],
  space: [0x09, 0x0d, 0x20, 0x20],
  upper: /*#__PURE__*/range("A", "Z"),
  word: [... /*#__PURE__*/range("0", "9"), ... /*#__PURE__*/range("A", "Z"), 0x5f, 0x5f, ... /*#__PURE__*/range("a", "z")],
  xdigit: [... /*#__PURE__*/range("0", "9"), ... /*#__PURE__*/range("A", "F"), ... /*#__PURE__*/range("a", "f")]
};
// POSIX class names are at most six characters.
const parsePosixClass = (chars, open) => {
  for (let i = open + 2; i < chars.length && i <= open + 8; i++) {
    if (chars[i] === ":" && chars[i + 1] === "]") {
      const ranges = posixClasses[chars.slice(open + 2, i).join("")];
      return ranges === undefined ? undefined : {
        ranges,
        end: i + 1
      };
    }
  }
  return undefined;
};
// Share class boundaries between brace expansion and segment compilation.
const parseClass = (chars, open) => {
  let i = open + 1;
  const negated = chars[i] === "!" || chars[i] === "^";
  if (negated) {
    i++;
  }
  const ranges = [];
  for (let first = true; i < chars.length; i++, first = false) {
    let char = chars[i];
    if (char === "/") {
      return undefined;
    }
    if (char === "]" && !first) {
      return {
        token: {
          _tag: "Class",
          ranges,
          negated
        },
        end: i
      };
    }
    if (char === "[" && chars[i + 1] === ":") {
      const posix = parsePosixClass(chars, i);
      if (posix !== undefined) {
        ranges.push(...posix.ranges);
        i = posix.end;
        continue;
      }
    }
    if (char === "\\" && i + 1 < chars.length) {
      char = chars[++i];
    }
    if (chars[i + 1] === "-" && i + 2 < chars.length && chars[i + 2] !== "]") {
      let next = i + 2;
      if (chars[next] === "/") {
        return undefined;
      }
      if (chars[next] === "\\" && next + 1 < chars.length) {
        next++;
      }
      ranges.push(...range(char, chars[next]));
      i = next;
      continue;
    }
    ranges.push(...range(char, char));
  }
  return undefined;
};
const expandBraces = pattern => {
  const chars = Array.from(pattern);
  const groups = matchBraceGroups(chars);
  if (groups.size === 0) {
    return [pattern];
  }
  const sequence = parseBraceSequence(chars, 0, chars.length, groups, 0);
  if (sequence === undefined) {
    return [pattern];
  }
  const count = countExpansions(sequence);
  return count > maxExpansions || count * pattern.length > maxExpandedLength ? [pattern] : expandSequence(sequence);
};
// Index expandable brace groups by opening position, ignoring bracket classes.
const matchBraceGroups = chars => {
  const groups = new Map();
  const stack = [];
  let classes = true;
  for (let i = 0; i < chars.length; i++) {
    const char = chars[i];
    if (char === "\\") {
      i++;
    } else if (char === "/") {
      classes = true;
    } else if (char === "[" && classes) {
      const parsed = parseClass(chars, i);
      if (parsed === undefined) {
        classes = false;
      } else {
        i = parsed.end;
      }
    } else if (char === "{") {
      stack.push({
        open: i,
        commas: []
      });
    } else if (char === ",") {
      stack[stack.length - 1]?.commas.push(i);
    } else if (char === "}") {
      const group = stack.pop();
      if (group !== undefined && group.commas.length > 0) {
        groups.set(group.open, {
          commas: group.commas,
          close: i
        });
      }
    }
  }
  return groups;
};
const parseBraceSequence = (chars, start, end, groups, depth) => {
  if (depth > maxBraceDepth) {
    return undefined;
  }
  const parts = [];
  let text = "";
  for (let i = start; i < end; i++) {
    const group = groups.get(i);
    if (group === undefined) {
      if (chars[i] === "\\" && i + 1 < end) {
        text += chars[i++];
      }
      text += chars[i];
      continue;
    }
    const alternatives = [];
    let from = i + 1;
    for (const to of [...group.commas, group.close]) {
      const alternative = parseBraceSequence(chars, from, to, groups, depth + 1);
      if (alternative === undefined) {
        return undefined;
      }
      alternatives.push(alternative);
      from = to + 1;
    }
    if (text !== "") {
      parts.push(text);
      text = "";
    }
    parts.push(alternatives);
    i = group.close;
  }
  if (text !== "") {
    parts.push(text);
  }
  return parts;
};
const countExpansions = sequence => {
  let count = 1;
  for (const part of sequence) {
    if (typeof part !== "string") {
      let sum = 0;
      for (const alternative of part) {
        sum += countExpansions(alternative);
      }
      count *= sum;
      if (count > maxExpansions) {
        return Infinity;
      }
    }
  }
  return count;
};
const expandSequence = sequence => {
  let out = [""];
  for (const part of sequence) {
    if (typeof part === "string") {
      out = out.map(prefix => prefix + part);
    } else {
      const alternatives = part.flatMap(expandSequence);
      out = out.flatMap(prefix => alternatives.map(alternative => prefix + alternative));
    }
  }
  return out;
};
// -----------------------------------------------------------------------------
// matching
// -----------------------------------------------------------------------------
const matchToken = (token, code) => {
  switch (token._tag) {
    case "Char":
      return token.code === code;
    case "Any":
      return true;
    case "Star":
      return false;
    case "Class":
      {
        let found = false;
        for (let i = 0; i < token.ranges.length && !found; i += 2) {
          found = code >= token.ranges[i] && code <= token.ranges[i + 1];
        }
        return found !== token.negated;
      }
  }
};
// UTF-16 length of the code point
const width = code => code > 0xffff ? 2 : 1;
// Backtrack only to the last `*`, bounding retries by tokens × characters.
const matchWildcard = (node, name, dot) => {
  if (name === "." || name === ".." || name.startsWith(".") && !dot && !node.leadingDot) {
    return false;
  }
  if (node.affixes !== undefined) {
    const {
      prefix,
      suffix
    } = node.affixes;
    return name.length >= prefix.length + suffix.length && name.startsWith(prefix) && name.endsWith(suffix);
  }
  const {
    tokens
  } = node;
  let t = 0;
  let c = 0;
  let star = -1;
  let resume = 0;
  while (c < name.length) {
    if (tokens[t]?._tag === "Star") {
      star = t++;
      resume = c;
      continue;
    }
    const code = name.codePointAt(c);
    if (t < tokens.length && matchToken(tokens[t], code)) {
      t++;
      c += width(code);
    } else if (star !== -1) {
      t = star + 1;
      resume += width(name.codePointAt(resume));
      c = resume;
    } else {
      return false;
    }
  }
  while (tokens[t]?._tag === "Star") {
    t++;
  }
  return t === tokens.length;
};
// `**` also matches zero segments, so its successor is reachable too
const closure = (nodes, states) => {
  for (const state of states) {
    if (nodes[state]._tag === "Globstar") {
      states.add(state + 1);
    }
  }
  return states;
};
const step = (compiled, states, name) => {
  const explicit = new Set();
  const viaGlobstar = new Set();
  // only a literal segment can name the root of an absolute path
  const root = isRoot(name);
  for (const state of states) {
    const node = compiled.nodes[state];
    switch (node._tag) {
      case "Globstar":
        {
          if (!root && name !== "." && name !== ".." && (compiled.dot || !name.startsWith("."))) {
            viaGlobstar.add(state);
          }
          break;
        }
      case "Literal":
        {
          if (node.value === name) {
            explicit.add(state + 1);
          }
          break;
        }
      case "Wildcard":
        {
          if (!root && matchWildcard(node, name, compiled.dot)) {
            explicit.add(state + 1);
          }
          break;
        }
    }
  }
  return {
    explicit: closure(compiled.nodes, explicit),
    globstar: closure(compiled.nodes, viaGlobstar)
  };
};
const union = step => {
  if (step.globstar.size === 0) {
    return step.explicit;
  }
  const states = new Set(step.explicit);
  for (const state of step.globstar) {
    states.add(state);
  }
  return states;
};
const accepts = (compiled, states, isDirectory) => {
  for (const state of states) {
    const node = compiled.nodes[state];
    if (node._tag === "End" && (isDirectory || !node.directoryOnly)) {
      return true;
    }
  }
  return false;
};
const canDescend = (compiled, states) => {
  for (const state of states) {
    if (compiled.nodes[state]._tag !== "End") {
      return true;
    }
  }
  return false;
};
const needsDirectory = (compiled, states) => {
  for (const state of states) {
    const node = compiled.nodes[state];
    if (node._tag === "End" && node.directoryOnly) {
      return true;
    }
  }
  return false;
};
// `step` and `union` over bitmasks; a `**` node's successor is the next bit
const stepMasks = (compiled, masks, states, name, root) => {
  let next = !root && name !== "." && name !== ".." && (compiled.dot || !name.startsWith(".")) ? states & masks.globstar : 0;
  // the remaining states are `Literal` and `Wildcard` nodes
  let segments = states & ~(masks.globstar | masks.end);
  while (segments !== 0) {
    const bit = segments & -segments;
    segments ^= bit;
    const node = compiled.nodes[31 - Math.clz32(bit)];
    if (node._tag === "Literal" ? node.value === name : node._tag === "Wildcard" && !root && matchWildcard(node, name, compiled.dot)) {
      next |= bit << 1;
    }
  }
  return next | (next & masks.globstar) << 1;
};
/** @internal */
export const match = (compiled, path) => {
  if (path === "" || isUnc(path)) {
    return false;
  }
  const {
    masks
  } = compiled;
  if (masks === undefined) {
    const {
      directory,
      segments
    } = normalize(path.split("/"));
    let states = compiled.initial;
    for (const name of segments) {
      states = union(step(compiled, states, name));
      if (states.size === 0) {
        return false;
      }
    }
    return accepts(compiled, states, directory);
  }
  // The same segments as `normalize(path.split("/"))`, without the arrays
  let states = masks.initial;
  let stepped = false;
  let start = 0;
  let end = path.indexOf("/");
  if (end === 0 || end === 2 && drive.test(path)) {
    states = stepMasks(compiled, masks, states, path.slice(0, end === 0 ? 0 : 3), true);
    stepped = true;
    start = end + 1;
    end = path.indexOf("/", start);
  }
  let directory = false;
  let dotted = false;
  while (states !== 0) {
    const name = end === -1 ? path.slice(start) : path.slice(start, end);
    if (name === "" || name === ".") {
      dotted ||= name === ".";
      directory = end === -1 && stepped;
    } else {
      states = stepMasks(compiled, masks, states, name, false);
      stepped = true;
      directory = false;
    }
    if (end === -1) {
      break;
    }
    start = end + 1;
    end = path.indexOf("/", start);
  }
  if (!stepped && dotted) {
    states = stepMasks(compiled, masks, states, ".", false);
  }
  return (states & (directory ? masks.end : masks.endFile)) !== 0;
};
// -----------------------------------------------------------------------------
// file system walk
// -----------------------------------------------------------------------------
const join = (parent, name) => {
  if (parent === "") {
    return name === "" ? "/" : name;
  }
  return parent.endsWith("/") ? parent + name : `${parent}/${name}`;
};
const isMissing = error => error.reason._tag === "NotFound" || error.reason._tag === "BadResource";
const isIgnorable = error => isMissing(error) || error.reason._tag === "PermissionDenied";
// Node and Deno report `readLink` on a path that is not a link as "Unknown"
const isNotLink = error => isIgnorable(error) || error.reason._tag === "Unknown";
const DIRECTORY_CONCURRENCY = 16;
const byName = /*#__PURE__*/Order.mapInput(Order.String, entry => entry.name);
/** @internal */
export const make = fs => (pattern, options) => walk(fs, compile([pattern], options?.dot ?? false), options);
// Named directories (the root and those reached only through leading literal
// segments) must be readable; unreadable wildcard-reached ones are skipped.
const walk = /*#__PURE__*/Effect.fnUntraced(function* (fs, compiled, options) {
  if (compiled.initial.size === 0) {
    return [];
  }
  const root = options?.root ?? "";
  const excludes = compile(options?.exclude ?? [], true);
  const excludeNeedsDirectory = excludes.nodes.some(node => node._tag === "End" && node.directoryOnly);
  const toFsPath = relative => isAbsolute(relative) ? relative : relative === "" ? root === "" ? "." : root : join(root, relative);
  // Listings never contain `.`, `..`, or the root of an absolute pattern
  const isUnlisted = value => value === "." || value === ".." || isRoot(value);
  // Keep broken links so literal probes agree with directory listings.
  const probe = (parent, name, named) => {
    const path = toFsPath(join(parent, name));
    return fs.stat(path).pipe(Effect.map(info => info.type), Effect.catchReason("PlatformError", "NotFound", () => fs.readLink(path).pipe(Effect.as("SymbolicLink"), Effect.catchIf(isNotLink, () => Effect.succeed(undefined)))), Effect.catchIf(named ? isMissing : isIgnorable, () => Effect.succeed(undefined)), Effect.map(type => type === undefined ? undefined : {
      name,
      type
    }));
  };
  // Probe leading literals without requiring permission to list their parent.
  const entries = (relative, states, named) => {
    const literals = new Set();
    let listed = !named;
    for (const state of states) {
      const node = compiled.nodes[state];
      if (node._tag === "Literal") {
        literals.add(node.value);
      } else if (node._tag !== "End") {
        listed = true;
      }
    }
    const probed = listed ? [...literals].filter(isUnlisted) : [...literals];
    return Effect.zipWith(listed ? Effect.catchIf(fs.readDirectoryEntries(toFsPath(relative)), named ? isMissing : isIgnorable, () => Effect.succeed([])) : Effect.succeed([]), Effect.forEach(probed, name => probe(relative, name, named), {
      concurrency: 16
    }), (listing, found) => ({
      entries: Arr.sort([...listing, ...found.filter(Predicate.isNotUndefined)], byName),
      named: named && !listed
    }));
  };
  // Synchronous unless the entry type must be resolved through `stat` / `readLink`
  const visit = ({
    name,
    type
  }, parent, states, excluded) => {
    const result = step(compiled, states, name);
    const next = union(result);
    if (next.size === 0) {
      return undefined;
    }
    const relative = join(parent, name);
    const nextExcluded = union(step(excludes, excluded, name));
    const descend = canDescend(compiled, next);
    const child = (isDirectory, link) => {
      const accepted = accepts(compiled, next, isDirectory);
      if (!accepted && (!isDirectory || !descend) || accepts(excludes, nextExcluded, isDirectory)) {
        return undefined;
      }
      return {
        relative,
        accepted,
        excluded: nextExcluded,
        next: !isDirectory || !descend ? undefined : !link || result.globstar.size === 0 ? next
        // Follow symlinks only through explicit segments, not `**`.
        : canDescend(compiled, result.explicit) ? result.explicit : undefined
      };
    };
    if (!descend && !needsDirectory(compiled, next) && !excludeNeedsDirectory) {
      return child(false, false);
    }
    if (type !== "Unknown" && type !== "SymbolicLink") {
      return child(type === "Directory", false);
    }
    const path = toFsPath(relative);
    return fs.stat(path).pipe(Effect.map(info => info.type === "Directory"), Effect.catchIf(isIgnorable, () => Effect.succeed(false)), Effect.flatMap(isDirectory => {
      const resolved = child(isDirectory, type === "SymbolicLink");
      if (type === "SymbolicLink" || resolved?.next === undefined || result.globstar.size === 0) {
        return Effect.succeed(resolved);
      }
      return fs.readLink(path).pipe(Effect.as(child(isDirectory, true)), Effect.catchIf(isNotLink, () => Effect.succeed(resolved)));
    }));
  };
  // Walk subdirectories in forked fibers while slots are free and inline
  // otherwise, bounding directory reads in flight across the whole walk. A
  // forked walk reports its failure through `failed` so the whole walk ends
  // promptly even while its parent is walking another subdirectory inline.
  // Once the root walk is finishing, forked walks only exit because it
  // interrupts them.
  let slots = DIRECTORY_CONCURRENCY;
  let finishing = false;
  const failed = Deferred.makeUnsafe();
  const fork = walk => walk.pipe(Effect.onError(cause => Effect.sync(() => {
    if (!finishing) {
      Deferred.doneUnsafe(failed, Effect.failCause(cause));
    }
  })), Effect.ensuring(Effect.sync(() => {
    slots++;
  })), Effect.forkChild);
  const directory = Effect.fnUntraced(function* (relative, states, excluded, named) {
    const listing = yield* entries(relative, states, named);
    const children = [];
    const pending = [];
    for (const entry of listing.entries) {
      const child = visit(entry, relative, states, excluded);
      if (Effect.isEffect(child)) {
        const index = children.push(undefined) - 1;
        pending.push(Effect.map(child, child => {
          children[index] = child;
        }));
      } else {
        children.push(child);
      }
    }
    if (pending.length > 0) {
      yield* Effect.all(pending, {
        concurrency: 16,
        discard: true
      });
    }
    const subtrees = [];
    for (const child of children) {
      if (child?.next !== undefined) {
        const walk = directory(child.relative, child.next, child.excluded, listing.named);
        if (slots > 0) {
          slots--;
          subtrees.push(Fiber.join(yield* fork(walk)));
        } else {
          subtrees.push(Effect.succeed(yield* walk));
        }
      }
    }
    // Splice subtrees back in listing order
    const out = [];
    let index = 0;
    for (const child of children) {
      if (child === undefined) {
        continue;
      }
      if (child.accepted) {
        out.push(child.relative);
      }
      if (child.next !== undefined) {
        for (const path of yield* subtrees[index++]) {
          out.push(path);
        }
      }
    }
    return out;
  });
  // The losing walk is interrupted along with every fiber it forked
  return yield* Effect.raceFirst(Effect.ensuring(directory("", compiled.initial, excludes.initial, true), Effect.sync(() => {
    finishing = true;
  })), Deferred.await(failed));
});
//# sourceMappingURL=glob.js.map