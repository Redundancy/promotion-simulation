# TESTING.md

Hand-curated list of states and click-paths that have produced real bugs in
this codebase, plus the things you should always check before claiming
something works. Read this before adding features that touch persistence,
state shape, or the topology sheet.

If you fix a bug that wasn't caught by these checks, add the scenario here.

---

## State persistence / hydration

State is persisted to `localStorage` per scenario, keyed
`sim-prototype.v3.<scenarioId>`. `STORAGE_LAST_SCENARIO` records which one to
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

## Things to manually click before claiming "done"

After any change that touches state, persistence, or rendering:

1. Clear `localStorage`. Pick **s1-onboarding**. Edit, deploy, validate.
2. Reload page mid-scenario. Workspace should restore exactly.
3. Pick **s2-promotion**. Edit dev's config, deploy, promote→deploy through
   staging→prod, validate.
4. Pick **s3-branch-per-env**. Open topology. Switch FileTree branches
   among dev/staging/prod. Edit `layers/defaults.json` on dev. Deploy dev.
   Promote dev→staging (verify trace says `copy-branch`). Switch to
   staging branch in FileTree — `defaults.json` should show dev's content.
   Deploy staging. Repeat for prod. Validate.
5. **Cross-scenario hydration:** mid-scenario, exit to intro, pick a
   different scenario. State should reset cleanly for the new scenario;
   re-entering the previous one should restore its state.
6. **Mid-deploy exit:** click deploy, immediately exit to intro. No crash;
   no spurious `DEPLOY_RESOLVED` against the wrong scenario.
7. Browser console: only the expected Babel "in-browser transformer"
   warning. Anything else means a real issue.
