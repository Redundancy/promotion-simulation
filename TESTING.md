# TESTING.md

Hand-curated list of states and click-paths that have produced real bugs in
this codebase, plus the things you should always check before claiming
something works. Read this before adding features that touch persistence,
state shape, or the topology sheet.

If you fix a bug that wasn't caught by these checks, add the scenario here.

---

## State persistence / hydration

State is persisted to `localStorage` per scenario, keyed
`sim-prototype.v7.<scenarioId>`. `STORAGE_LAST_SCENARIO` records which one to
hydrate on load. The persistence layer **strips transient fields** (currently
`deploying`) before saving — they are not meaningful across sessions.

**Anything new you add to the reducer state must be either persisted, or
backfilled in `HYDRATE`.** `state.jsx`'s `HYDRATE` case spreads
`emptyState()` defaults under the saved state, so missing fields get a sane
default rather than `undefined`. Adding a transient that consumers index into
without that backfill is a recipe for `Cannot read properties of undefined`.

### Bugs in this category

- **`state.deploying = undefined` after reload.** Persistence strips
  `deploying`; hydration restored a state without it; `EnvNodeCard` did
  `state.deploying[envName]` and threw `Cannot read properties of undefined
  (reading 'dev')`. Fixed by (a) `HYDRATE` backfilling from `emptyState()`
  and (b) optional-chain at the consumer
  (`state.deploying && state.deploying[name]`).

### Always check

- Reload the page after each non-trivial state mutation. Open every sheet.
  Switch branches. Open every file. The hydrated state must render
  identically to the live state.
- Add a new field? Make sure `emptyState()` declares it and the consumer
  doesn't crash if it's missing.

---

## Scenario / state mismatch

Saved state for scenario `X` can persist on disk while the scenario *code*
changes. The stored `scenarioId` is the only link between the two.

### Plausible failure modes

- **Saved state references a scenario that no longer exists** (renamed,
  removed). `makeStateForScenario` returns `emptyState()`. App routes to
  intro chooser. Should be safe — but if you add code that assumes a saved
  scenario is always present, you'll regress it.
- **Saved state has env names / branch names from an older scenario shape.**
  The reducer doesn't validate that `state.envs` matches
  `scenario.topologyNodes`. Renderers that look up
  `nodes[envName]` / `envs[envName]` need null-checks.
- **Saved state has `topologyOpen: true` but the scenario's nodes don't
  match the saved envs.** `TopologySheet` renders, iterates whichever set
  it's given. Defensive guards in `TopologySheet` and `EnvNodeCard` early-
  return rather than crash.

### Always check

- For any scenario change (renaming a scenario, changing env names, changing
  source paths), bump the schema version in `state.jsx`
  (`STORAGE_KEY_PREFIX` and `SCHEMA_VERSION`) so old saves are dropped on
  hydrate.

---

## Branch switching with topology open

The file-tree branch dropdown dispatches `SWITCH_BRANCH`, which only
mutates `state.repo.currentBranch`. If `TopologySheet` is open at the time,
it re-renders with the new state but unchanged `state.envs` — env source
pointers don't follow the file-tree picker. This is correct behavior, but
it means changes to either component must consider the other's render path.

### Bugs in this category

- The `state.deploying = undefined` bug above was originally reported as
  "an error switching branches". Branch-switching just happened to be the
  re-render trigger that surfaced the latent state-shape bug.

### Always check

- After any change to `FileTree`, `TopologySheet`, or `EnvNodeCard`:
  open topology, switch FileTree branches several times, change env source
  pickers, then reload. No errors.

---

## Async deploy lifecycle

`runtime.jsx` spawns a sandbox worker per deploy. The flow is:
`DEPLOY_START` → spawn worker → resolve → `DEPLOY_RESOLVED` → terminate.
The worker is read-aware: it round-trips `read` requests to the host via
`postMessage`, and the host reads from `getState()` (a ref) so reads see
the latest state.

### Plausible failure modes

- **User edits a file while a deploy is in flight** — script reads the new
  content. This is *intentional* (script is not racing with edits because
  edits are sync from the user's POV) but worth being aware of.
- **User exits to intro mid-deploy.** `DEPLOY_RESOLVED` arrives at a state
  with no envs. Reducer early-returns. Worker is terminated by the `finish`
  handler.
- **User picks a different scenario mid-deploy.** Same as exit — new state
  has different envs. The DEPLOY_RESOLVED action targets an env that may
  not exist in the new scenario's state. Reducer's early-return guards
  this.

### Always check

- `DEPLOY_RESOLVED` handler in `state.jsx` returns `state` unchanged when
  `state.envs[action.env]` is missing. Don't remove that guard.

---

## Babel-standalone caching

`<script type="text/babel" src="X">` fetches `X` via Babel-standalone's
loader. **Some browsers cache the response even with `Cache-Control:
no-store` from the server.** Edits to `.jsx` files won't appear on reload
unless the script src has a unique query string.

`app/index.html` cache-busts with `?v=${Date.now()}` per script tag at page
load (via inline `document.write`). Don't remove that — it's the only
reliable way to force re-fetch during dev.

If you ever see "my code change isn't running":

1. `curl -sI http://localhost:5173/app/prototype/<file>.jsx` — does the
   server send the new content?
2. In the browser, inspect the inline script (the compiled output that
   Babel inserts into the DOM). Does it match the source on disk?
3. If (1) is fresh and (2) is stale, it's a browser-cache issue.
   Hard-reload (or rely on the `?v=` cache-bust).

---

## Sandbox worker determinism

The sandbox worker (`sandbox.worker.js`) is set up to be reproducible:
`Date` is frozen, `Math.random` throws, `fetch`/`XHR`/`WebSocket`/
`importScripts` are removed. Don't add capabilities to it without a
scenario that genuinely needs them.

### Always check

- A new script source should fail loudly if it tries to use a removed API.
- Scripts return JSON-serializable values (the worker round-trips through
  `JSON.stringify` to enforce this).

---

## Participant-authored repo (branches / files / promote effects)

The participant can create branches, create/delete files, and configure
promote effects. State is in `state.repo.branches` (with `currentBranch`),
`state.envs[name].source`, and `state.promoteEdges` (seeded from the
scenario's `promoteEdges` and edited from then on).

### Bugs in this category

- **Persistence wipe on chooser re-entry.** `LOAD_SCENARIO` always builds
  fresh state via `makeStateForScenario`. If the chooser button always
  dispatched `LOAD_SCENARIO`, clicking back-into-the-current-scenario from
  the topbar's "← scenarios" link would silently wipe the participant's
  progress. Fixed: the chooser tries `localStorage.getItem(storageKeyFor(id))`
  first and dispatches `HYDRATE` when a v7 save exists; falls back to
  `LOAD_SCENARIO` otherwise.
- **envs.json / promotions.json conflated with repo files.** Earlier
  versions projected these into every branch as auto-managed read-only
  files. They're global scenario state, not per-branch repo content;
  putting them in branches confused things and made `copy-branch` writes
  bring stale projection data along. They no longer appear as files at
  all — the structured UIs (env source picker, topology effects editor)
  are the canonical editors.
- **Default-snapshot promote behavior was sneaky.** With no effects
  declared, promote used to do an implicit snapshot (copy from-env's
  source text into to-env's source path). That meant the participant
  thought they were configuring nothing, but the simulator was doing work
  for them. Removed: with zero effects declared on an edge, promote is a
  true no-op (records a trace event, doesn't write any files, doesn't
  set `pendingFrom`). Scenarios that want promote to actually move
  things must declare `copy-file` or `copy-branch` effects explicitly.

### Always check

- Add new fields to state? `emptyState()` must declare them, the HYDRATE
  backfill (`{ ...emptyState(), ...action.state }`) covers absences.
- Bump the schema version (currently v7) and `STORAGE_KEY_PREFIX` when
  any persisted-state shape changes.
- Confirm the chooser restores from a save; then a fresh-pick (via
  `__reset` and re-pick) starts clean.
- Adding a new scenario? Confirm: empty `promoteEdges` works (no-op
  promote), `copy-file` and `copy-branch` effects work, the participant
  can create branches and files atop the seed without colliding.

---

## Things to manually click before claiming "done"

After any change that touches state, persistence, or rendering:

1. Clear `localStorage`. Pick **s1-onboarding**. Edit, deploy, validate.
2. Reload page mid-scenario. Workspace should restore exactly.
3. Pick **s2-promotion**. Edit dev's config, deploy, promote→deploy through
   staging→prod, validate.
4. Pick **s3-by-hand**. Confirm five envs (dev, staging, prod-east,
   prod-west, prod-eu) and five per-env JSON files in `main`. Bump
   `appVersion` to v1.1.0 in every file AND update `cacheKey` to
   `checkout-api-v1.1.0` in every file. Promote each edge for the lineage
   directive. All seven directives ✓. (If a single cacheKey is
   forgotten, the matching env's directive flags it.)
5. Pick **s4-build-script**. Confirm single branch (main) with `build.js`
   and `config/version.json`. The seeded `build.js` has a TODO and only
   returns `{ appVersion }` — the expected pane should show
   `logLevel`/`replicas` as missing. Edit `build.js` to add tier-derived
   `logLevel` and `replicas`. Edit version to v1.1.0. Deploy dev → expected
   keys filled in for tier "dev". Deploy staging → values for tier
   "staging". Deploy prod → values for tier "prod". All five directives ✓.
6. Pick **s5-layered**. Confirm `defaults.json` and three env override
   files. The seeded `build.js` has a TODO and reads only defaults — every
   env shows `logLevel: info`. Extend `build.js` to read
   `config/env/${env.name}.json` and merge it on top. Edit `defaults.json`
   to `appVersion: v1.1.0`. Deploy each env → dev gets debug from
   override, prod gets warn, staging keeps info from defaults. All five
   directives ✓.
7. Pick **s6-branching**. Three branches (dev, staging, prod), each with
   its own copy of `build.js` + `config/version.json`. Switch FileTree to
   dev's branch. Edit dev's `build.js` to add `cacheKey:
   ${env.name}-${appVersion}`. Edit dev's `config/version.json` to v1.1.0.
   Deploy dev — d1 turns green; d2/d3 stay green because staging/prod's
   branches are untouched at v1.0.0 (this is the lesson). Promote
   dev→staging, deploy staging, promote staging→prod, deploy prod. All
   five directives ✓.
8. Pick **s7-branch-per-env**. Open topology. Switch FileTree branches
   among dev/staging/prod. Edit `layers/defaults.json` on dev. Deploy dev.
   Promote dev→staging (verify trace says `copy-branch`). Switch to
   staging branch in FileTree — `defaults.json` should show dev's content.
   Deploy staging. Repeat for prod. Validate.
9. Pick **s8-routine-ship**. Confirm advisory trigger fires after dev
   deploy at v1.1.0. Bring all envs into compliance with the new
   requirement.
10. **Cross-scenario hydration:** mid-scenario, exit to intro, pick a
    different scenario. State should reset cleanly for the new scenario;
    re-entering the previous one should restore its state.
11. **Mid-deploy exit:** click deploy, immediately exit to intro. No crash;
    no spurious `DEPLOY_RESOLVED` against the wrong scenario.
12. Browser console: only the expected Babel "in-browser transformer"
    warning. Anything else means a real issue.
