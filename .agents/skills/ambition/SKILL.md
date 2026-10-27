---
name: ambition
description: Raise the ambition of a task before executing it, along Altitude (the outcome beyond the task), Depth (what a top expert would do), and Range (other fields to borrow from). Use when the user says "be more ambitious", "go deeper", "think bigger", or asks to rethink or upgrade a prompt or plan.
---

Do not execute the task as literally written. First lift it along the axes below, then show the user the upgraded task and run it once they agree. Speed (the same work faster) is the default; ignore it here.

## Altitude: the goal beyond the goal

Ask what the user wants to happen next, then aim at that outcome.

1. Name the outcome the task serves (a decision made, a problem that stays fixed, a workflow that no longer needs the user).
2. Climb in steps, each one wider than the last: do the task, explain what changed and why, recommend the decisions that follow with for/against, then replace the process that produced the task.
3. List what must exist for the model to run unattended: data access, a way to reproduce and verify, a mapping from artefact to source.

Altitude fits outcome-driven work, such as work that ends in a meeting. It fits creative work poorly.

## Depth: what a field-leading expert would do

Go one level below the task, to the raw data, tools, and problems.

1. Use the instruments the best practitioners use (databases and statistical models, not markdown tables).
2. Set a goal that looks unreasonable and state it as solvable (200ms, not 5s).
3. Attack what the user believes: give the model the raw material and have it try to reproduce the belief adversarially.
4. Ask for new knowledge: a blind spot, an early signal, a prediction that holds on unseen data.
5. Require an outside judge, meaning a tool the model can run for immediate feedback. Never have the model grade itself.

## Range: borrow from other fields

1. Replace the nouns with verbs. "A deck" becomes "getting busy people to believe a causal story and decide under uncertainty in 30 minutes."
2. From the verbs, list the fields and techniques that do that well, and the crew to cover them (analyst, editor, designer, red team).
3. Borrow what each field does, not how it talks. "Research the position the way a short seller does", never "write like a short seller". Role play adds noise and no quality.
4. Fan out to subagents only when the fields are independent.

## Deeper-not-bigger rewrite

When the user wants depth without extra scope, answer these four before rewriting the prompt:

1. What would a top professional do here that the user did not ask for?
2. What is the rawest material they would start from, rather than the digested version?
3. Which specific methods and tools would they use?
4. What, other than the model or the user, would show the result is right?

Then rewrite the prompt to ask for exactly that.

## Output

Return a short upgraded task: outcome, method and tools, outside judge, and any access still missing. Ask the user to confirm before executing it. In this repo, still honour the stop conditions in `AGENTS.md`; ambition never licenses resolving gameplay questions silently or weakening a gate.
