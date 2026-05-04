/* global window */
// Scenario host + shared helpers.
//
// Each scenario file calls window.defineScenario({ ... }) to register itself.
// data.jsx is loaded before any scenario file; scenario files are loaded
// before state.jsx (which reads window.SCENARIOS at boot).
//
// Scenario spec:
//   {
//     id:            "s1",
//     title:         "three envs, one shared value",
//     premise:       "...",                   // text shown on intro
//     summary:       "short blurb",           // shown in scenario chooser
//     branches:      { main: { path: text, ... }, ... },
//     envs:          { name: { tier, region, source: { branch, path },
//                              version, artifactId, lineage, lastDeploy }, ... },
//     envOrder:      ["dev", "staging", "prod"],
//     promoteEdges:  [{ id, from, to }, ...],
//     topologyNodes: { name: { x, y }, ... },
//     configSchema:  { ... },                  // for the JSON-schema editor lint
//     directives:    [{ id, kind, label, check(api): boolean }, ...],
//   }

const SCENARIOS = [];

function defineScenario(spec) {
  if (!spec || !spec.id) throw new Error("defineScenario: spec.id required");
  const existing = SCENARIOS.findIndex((s) => s.id === spec.id);
  if (existing >= 0) {
    console.warn(`scenario ${spec.id} already defined; replacing`);
    SCENARIOS.splice(existing, 1);
  }
  SCENARIOS.push(spec);
}

function listScenarios() {
  return SCENARIOS.slice();
}

function getScenario(id) {
  return SCENARIOS.find((s) => s.id === id) || null;
}

// ─────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────

function parseConfig(text) {
  try { return JSON.parse(text); } catch { return null; }
}

function isConfigPath(path) {
  return !!path && path.startsWith("config/") && path.endsWith(".json");
}

// Find the env (in current state) whose source currently points at branch:path.
// Used by the breadcrumb. If multiple envs share a source, returns the first.
function envForSourceLocation(state, branch, path) {
  if (!state || !state.envs) return null;
  for (const e of Object.values(state.envs)) {
    if (e.source && e.source.branch === branch && e.source.path === path) return e.name;
  }
  return null;
}

function fmtTime(ts) {
  if (!ts || ts === "seed") return "—";
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

// Stable key for an open file across branches.
function fileKey(branch, path) { return `${branch}::${path}`; }
function parseFileKey(key) {
  if (!key) return null;
  const i = key.indexOf("::");
  if (i < 0) return null;
  return { branch: key.slice(0, i), path: key.slice(i + 2) };
}

// Materialise the expected config for an env at a given version. Scenarios
// can declare expected via either:
//   - expectedConfigFor(envIdentity, version, ctx) => Json    (preferred)
//   - expectedConfig: { [envName]: Json }                     (literal fallback)
//
// `version` is normally the env's currently-deployed version (env.version),
// so expected reflects "what should be true given the version running here
// right now".
//
// `ctx` carries cross-env scenario state the function may want to consult —
// chiefly `activeRequirements` (ids of in-force scenario requirements like
// security advisories that flip on additional config expectations).
//
// Returns null if no expected is declared.
function materializeExpected(scenario, envIdentity, version, ctx) {
  if (!scenario || !envIdentity) return null;
  const safeCtx = ctx || { activeRequirements: [] };
  if (typeof scenario.expectedConfigFor === "function") {
    try {
      const r = scenario.expectedConfigFor(envIdentity, version, safeCtx);
      return r === undefined ? null : r;
    } catch (e) {
      console.warn("expectedConfigFor threw", e);
      return null;
    }
  }
  if (scenario.expectedConfig && scenario.expectedConfig[envIdentity.name] !== undefined) {
    return scenario.expectedConfig[envIdentity.name];
  }
  return null;
}

// Build the ctx object that materializeExpected and expectedConfigFor see.
// Pulled out so all consumers stay in sync.
function expectedCtxFromState(state) {
  return {
    activeRequirements: state?.activeRequirements || [],
  };
}

// Identity attributes vs runtime fields — runtime fields aren't part of an
// env's "identity" passed to scenario authors. Shared with runtime.jsx
// (envIdentity) and scenarios/api.jsx (env() projection).
const ENV_RUNTIME_FIELDS = new Set([
  "source", "version", "artifactId", "lineage",
  "lastDeploy", "deployedSource", "pendingFrom", "config",
]);

function envIdentityOf(envState) {
  const out = {};
  for (const [k, v] of Object.entries(envState)) {
    if (!ENV_RUNTIME_FIELDS.has(k)) out[k] = v;
  }
  return out;
}

// Subset deep-equal: every (key, value) in `expected` must be present and
// deep-equal in `actual`. Extra keys in `actual` are fine. Returns the array
// of expected keys whose values mismatch (or are absent in actual). Empty
// array means "actual matches expected on every expected key".
function mismatchedExpectedKeys(actual, expected) {
  if (!expected || typeof expected !== "object" || Array.isArray(expected)) return [];
  const out = [];
  for (const k of Object.keys(expected)) {
    const av = actual && typeof actual === "object" ? actual[k] : undefined;
    if (JSON.stringify(av) !== JSON.stringify(expected[k])) out.push(k);
  }
  return out;
}

function deepEqualSubset(actual, expected) {
  return mismatchedExpectedKeys(actual, expected).length === 0;
}

// Render the canonical envs.json text for a set of env definitions. Used by
// the reducer when a source-remap action mutates the picker state.
function renderEnvsJson(envs, envOrder) {
  const order = envOrder || Object.keys(envs);
  return JSON.stringify({
    envs: order.map((name) => {
      const e = envs[name];
      return {
        name: e.name,
        tier: e.tier,
        region: e.region,
        source: { branch: e.source.branch, path: e.source.path },
      };
    }),
  }, null, 2);
}

// Render the canonical promotions.json text. Mirrors renderEnvsJson — a
// read-only projection of state.promoteEdges so participants can see what's
// configured. The topology UI is the canonical editor.
function renderPromotionsJson(promoteEdges) {
  return JSON.stringify({
    edges: (promoteEdges || []).map((e) => ({
      id: e.id,
      from: e.from,
      to: e.to,
      effects: (e.effects || []).map((eff) => ({ ...eff })),
    })),
  }, null, 2);
}

Object.assign(window, {
  // scenario registry
  defineScenario, listScenarios, getScenario,
  // helpers
  parseConfig, isConfigPath, envForSourceLocation, fmtTime,
  fileKey, parseFileKey, renderEnvsJson, renderPromotionsJson,
  // expected-config helpers
  materializeExpected, expectedCtxFromState, envIdentityOf, ENV_RUNTIME_FIELDS,
  mismatchedExpectedKeys, deepEqualSubset,
});
