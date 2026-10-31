---
name: research
description: Investigate a question against high-trust primary sources and publish the findings as a GitHub Discussion. Use when the user wants a topic researched, docs or API facts gathered, or reading legwork delegated to a background agent.
---

Spin up a **background agent** to do the research, so you keep working while it reads.

Its job:

1. Investigate the question against **primary sources** (official docs, source code, specs, first-party APIs), not a secondary write-up of them. Follow every claim back to the source that owns it.
2. Publish the findings to a single GitHub Discussion in the `Research` category, citing each claim's source: `gh discussion create --category Research --title "<slug>: <topic>" --body-file <note>`.
3. Never write the note into the repository. Link the discussion back to the spec issue, ticket, or PR that needed it.
