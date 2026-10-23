# HTML Report Format

The Effect review is rendered as a single self-contained HTML file in the OS temp directory. Tailwind and Mermaid both come from CDNs. Code panels carry the weight; Mermaid draws the graph-shaped gaps (layer graphs, fiber trees, scope nesting).

## Scaffold

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Effect use review for {{repo name}}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script type="module">
      import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";
      mermaid.initialize({ startOnLoad: true, theme: "neutral", securityLevel: "loose" });
    </script>
    <style>
      .leak { stroke: #dc2626; }
      .gone { background: #fef2f2; text-decoration: line-through; }
      .kept { background: #ecfdf5; }
    </style>
  </head>
  <body class="bg-stone-50 text-slate-900 font-sans">
    <main class="max-w-5xl mx-auto px-6 py-12 space-y-12">
      <header>...</header>
      <section id="gate-gaps">...</section>
      <section id="candidates" class="space-y-10">...</section>
      <section id="top-recommendation">...</section>
    </main>
  </body>
</html>
```

## Header

Repo name, date, scope (the direction or the hot spots used), and a domain strip listing all twenty domains as `hits` (accent) or `clean` (grey) from the sub-agent reports. A legend: red = leak, struck-through red = code that disappears, green = code that replaces it. No introduction paragraph.

The optional **Gate gaps** section lists real cases an existing gate misses, one line each with the gate script name. Omit it when empty.

## Candidate card

Each candidate is one `<article>`:

- **Title**: short, names the closed gap (e.g. "Give the save store a scoped handle").
- **Badge row**: strength (`Strong` = emerald, `Worth exploring` = amber, `Speculative` = slate), gap kind (`drift`, `leak`, `bypass`, `misplaced run`), domain (`error-management`, `scheduling`, ...), and any risk tags below.
- **Files**: monospaced list with `path:line`, `font-mono text-sm`.
- **Before / After**: two columns of `<pre>`. Before marks the deleted lines with `.gone`; After marks the replacement with `.kept`. Add one Mermaid diagram when the gap is shaped like a graph. Keep panels short: the 5 to 15 lines that carry the gap, with no code comments.
- **Problem**: one sentence. What hurts.
- **Direction**: one sentence. What changes, naming the Effect API and its `vendor/effect/src/<Module>.ts:line`.
- **Wins**: bullets, 6 words or fewer, in the terms below.
- **ADR callout** (if applicable): one line in an amber-tinted box.

No paragraphs of explanation. If the panel needs a paragraph to be understood, pick a smaller slice of the code.

### Risk tags

Add each tag that applies, red-tinted:

- `authoritative`: touches a package whose outputs feed authoritative hashes.
- `golden-hash`: could move a pinned artefact. Needs a decision request.
- `wire-format`: changes a frozen schema or envelope.
- `runtime-free`: edit stays inside the allowlisted `effect` subset.
- `edge`: lands in `persistence`, `content-compiler`, `apps/desktop/src/main`, or `apps/compiler-cli`.

## Top recommendation section

One larger card. Candidate name, one sentence on why, anchor link to its card.

## Tone

Plain, concise, in Effect's own nouns: **channel**, **requirement**, **layer**, **scope**, **fiber**, **schedule**, **edge**. Say `Effect.catchTag`, not "error handling helper".

**Wins phrasings that fit:**

- "Failure joins the error channel"
- "Requirements shrink to never"
- "Finalizer runs on interrupt"
- "Test drops real timers"
- "Delete 40-line retry loop"
- "One layer, built once"

Do not write "cleaner code" or "more idiomatic" as a win: name the channel, lifetime, or test that improves.

No hedging, no throat-clearing. If a sentence could be a bullet, make it a bullet. If a bullet could be cut, cut it.
