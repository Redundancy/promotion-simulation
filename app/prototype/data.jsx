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

Object.assign(window, {
  // scenario registry
  defineScenario, listScenarios, getScenario,
  // helpers
  parseConfig, isConfigPath, envForSourceLocation, fmtTime,
  fileKey, parseFileKey, renderEnvsJson,
});
