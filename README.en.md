# vuln-path-viz

[中文](README.md) | **English**

**Turn a vulnerability write-up into an execution-path diagram you can walk through, one line at a time.**

Left panel: step forward and read what happens. Right panel: a pannable, zoomable canvas of **real source-code cards** laid out by call depth, joined by colored curves that show the call relationships — which line entered which function, where it forked, where it was blocked or let through, and what impact it finally reached.

![example](examples/acme-reports/shots/step-10-fork.png)

- **Single file, zero dependencies, zero build** — the deliverable is one HTML file. Double-click it, screen-share it, mail it to someone.
- **Line numbers you can check** — cards quote real source. With `--src-root` the linter walks back into the source and compares every quoted line against the file at that exact line number.
- **Deep-linkable** — `?scene=KEY&step=12` pins any step, so it can go into an issue and be screenshotted headlessly.
- **Multi-vuln = tabs** — one engine, several scenes, so several chains on one product can be told in one page.

It exists to fix a specific failure: a 3000-word analysis only its author can follow, or a static call-graph image that gives you no entry point. The page stitches the two together — the graph gives you the whole, the steps give you the order.

## Quick start

```bash
git clone https://github.com/searcyan/vuln-path-viz.git
cd vuln-path-viz

# Look at it (no tooling needed — double-click also works)
open assets/viz-template.html             # skeleton scene
open examples/acme-reports/viz/index.html # full example: 17 steps through a privilege-escalation chain

# Copy the template, put your own code in
cp assets/viz-template.html my-viz/index.html

# Check and screenshot
node scripts/lint-scene.mjs my-viz/index.html
node scripts/lint-scene.mjs --src-root ./src my-viz/index.html   # also verify against source
node scripts/shot.mjs my-viz/index.html 8 my-viz/step8.png       # headless screenshot
```

Node 18+ is needed only for linting and screenshots — **the page itself needs nothing**. The screenshot script finds your local Chrome / Edge / Chromium, or takes `VULN_VIZ_BROWSER`.

Only the `SCENES` block between `/* ==== SCENES:BEGIN ==== */` and `/* ==== SCENES:END ==== */` is yours to edit; the engine below it stays untouched.

## Use it as an agent skill

The repo root *is* a skill: `SKILL.md` + `references/` + `assets/` + `scripts/`. Anything that understands `SKILL.md` (YAML frontmatter with `name` / `description`) can consume it directly:

```bash
# Claude Code (user level)
git clone https://github.com/searcyan/vuln-path-viz.git ~/.claude/skills/vuln-path-viz

# DeepSeek Harness (user level)
git clone https://github.com/searcyan/vuln-path-viz.git ~/.dsh/skills/vuln-path-viz

# Project level (travels with the repo, shared by the team)
git clone https://github.com/searcyan/vuln-path-viz.git .agents/skills/vuln-path-viz
```

Then just say "turn CVE-XXXX-YYYY into an execution-path explainer". The agent reads `SKILL.md`, derives cards from source following `references/authoring.md`, writes copy following `references/style.md`, and self-checks with `scripts/lint-scene.mjs`.

Tools without skill support still work: feed `SKILL.md` and `references/` to the model as a prompt, and use the template as the output format.

## Layout

```
SKILL.md                     the skill body: five-step workflow, three hard rules, delivery checklist
assets/viz-template.html     engine + skeleton scene (6 cards / 6 steps) — edit the SCENES block
references/
  data-model.md              every card / edge / step field, invariants, via/ret/jump semantics
  style.md                   palette, layout constants, row states, badge vocabulary, copy structure
  authoring.md               source → diagram: granularity, depth, edge order, evidence grading
scripts/
  lint-scene.mjs             data linter (with --src-root line-by-line source verification)
  shot.mjs                   headless Chrome/Edge screenshot (cross-platform)
examples/acme-reports/
  src/                       the synthetic "vulnerable" code (line numbers are the reference)
  viz/index.html             10 cards / 7 edges / 17 steps, complete example
  shots/                     screenshots
```

## What the example is telling

`examples/acme-reports` is a **synthetic** privilege-escalation chain, deliberately shaped like a common real-world bug:

ordinary user token → `POST /admin/config` → `require_session()` looks the token up → `check_route()` hits a shortcut that lets any `kind="ui"` token through on a path prefix → the handler has no role check at all → `set_env()` writes `ACME_LOGO_PATH=/etc/passwd` into `os.environ` → `GET /logo` hands the file back.

It is not a vulnerability in any real product. It exists so that every quoted line number can be verified against `examples/acme-reports/src/` with `--src-root`.

## What the linter checks

`node scripts/lint-scene.mjs [--src-root <dir>] <file.html>`

| Kind | Examples |
|---|---|
| error | an edge points at a missing card; a step's line number is not on its card; `via` points nowhere; an edge uses an undeclared `path` color; circled numbering out of order |
| error (`--src-root`) | the code quoted for line 18 differs from line 18 of the source file |
| warn | a row too long to fit (will be ellipsized); step text over ~420 chars; a new card with neither `via` nor an inbound edge; text citing a line number that no card shows; missing recap card |

The page also runs the same checks on load and logs to the console, so glancing at DevTools before shipping is not wasted effort.

## The three hard rules

1. **Line numbers must be real.** `loc` is `file:line`, `lines[].n` is the real line number, and the code is copied out of that file (state the version). Line numbers written from memory collapse the moment a reader opens the source.
2. **One path, one line.** Tell one walkable path per scene. Forks (deny / allow) get one edge each, in different colors — not two possibilities narrated inside one card.
3. **One thing per step.** One `line`, one conclusion. Second thought → second step.

## Show your viz

Built something with this? Open a [Show your viz](https://github.com/searcyan/vuln-path-viz/issues/new?template=show-your-viz.yml) issue and link it — real examples are the most convincing part of this repo.

## License

MIT, see [LICENSE](LICENSE). Example code and docs are yours to modify and redistribute.
