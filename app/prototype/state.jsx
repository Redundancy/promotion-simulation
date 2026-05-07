/* global React, window */
// State + reducer + localStorage persistence.
//
// Two source kinds:
//   - .json  → file content IS the resolved config (parse-and-apply)
//   - .js    → file is a build script (export default async build(env, api))
//              executed in the sandbox worker; its return value IS the config
//
// runtime.jsx owns the async boundary; this reducer only sees discrete
// actions. Deploy is two-step: DEPLOY_START (set deploying flag) and
// DEPLOY_RESOLVED (apply or record error).
//
// Promote:
//   - Effects declared on a promote edge are applied in order.
//   - If no effects declared, default behavior applies: copy from-env's
//     deployed source text into to-env's source-file path. (The classic
//     snapshot-into-target semantic; works for JSON sources where each env
//     has its own source file.)
//
// State shape:
//   {
//     scene:           "intro" | "workspace" | "debrief",
//     scenarioId:      string | null,
//     repo:            { branches: { [name]: { [path]: text } }, currentBranch: string },
//     dirty:           { [`${branch}::${path}`]: bool }
//     envs:            { [name]: {
//                         name, tier, region, ...identityAttrs,
//                         source: { branch, path },
//                         version, artifactId, lineage, lastDeploy,
//                         deployedSource, pendingFrom,
//                         config: Json | null,    // last-deployed resolved config
//                       } }
//     deploying:       { [envName]: true } during async deploy window
//     activeFile:      { branch, path } | null
//     openFiles:       [{ branch, path }, ...]
//     topologyOpen:    bool
//     confirm:         { kind, ...payload } | null
//     trace:           [{ at, kind, text, ts, ... }, ...]
//     nextTraceId:     number
//     directiveStates: { [id]: "satisfied" | "unsatisfied" }
//     completed:       bool
//   }

const STORAGE_KEY_PREFIX = "sim-prototype.v7";
const STORAGE_LAST_SCENARIO = "sim-prototype.v7.lastScenario";
const SCHEMA_VERSION = 7;

function storageKeyFor(scenarioId) {
  return `${STORAGE_KEY_PREFIX}.${scenarioId}`;
}

// ─────────────────────────────────────────────────────────────────────
// Initial state
// ─────────────────────────────────────────────────────────────────────

function emptyState() {
  return {
    scene: "intro",
    scenarioId: null,
    repo: { branches: {}, currentBranch: "main" },
    dirty: {},
    envs: {},
    promoteEdges: [],          // participant-editable; seeded from scenario.promoteEdges
    deploying: {},
    firedTriggers: [],         // ids of scenario triggers that have already fired
    activeRequirements: [],    // ids of in-force scenario requirements (drives expectedConfigFor)
    pendingAlert: null,        // alert awaiting participant acknowledgement (modal)
    guideOpen: false,          // "how this works" modal visibility
    activeFile: null,
    openFiles: [],
    topologyOpen: false,
    confirm: null,
    trace: [],
    nextTraceId: 1,
    directiveStates: {},
    completed: false,
  };
}

function deepClone(v) { return JSON.parse(JSON.stringify(v)); }

function makeStateForScenario(scenarioId) {
  const sc = window.getScenario(scenarioId);
  if (!sc) return emptyState();
  const branches = deepClone(sc.branches || { main: {} });
  const currentBranch = branches.main ? "main" : Object.keys(branches)[0];
  // Seed promote edges from scenario (deep clone — they become participant-
  // editable from this point on). Strip any `when` predicates the scenario
  // may have declared (legacy from when scenarios served multiple strategies
  // via a single edge); participants edit the effect list directly now.
  const seedEdges = deepClone(sc.promoteEdges || []).map((e) => ({
    id: e.id,
    from: e.from,
    to: e.to,
    effects: (e.effects || []).map((eff) => {
      const { when, ...rest } = eff;
      return rest;
    }),
  }));
  // Default-open: the env source script of the first env (if .js), else the
  // first config file, plus envs.json for orientation.
  const branchFiles = Object.keys(branches[currentBranch] || {});
  const envsPath = branchFiles.includes("envs.json") ? "envs.json" : null;
  const firstEnvOnCurrent = Object.values(sc.envs || {}).find(
    (e) => e.source && e.source.branch === currentBranch,
  );
  const openFiles = [];
  if (firstEnvOnCurrent) openFiles.push({ branch: currentBranch, path: firstEnvOnCurrent.source.path });
  const firstConfig = branchFiles.find((p) => window.isConfigPath(p));
  if (firstConfig && !openFiles.some((f) => f.path === firstConfig)) {
    openFiles.push({ branch: currentBranch, path: firstConfig });
  }
  if (envsPath && !openFiles.some((f) => f.path === envsPath))
    openFiles.push({ branch: currentBranch, path: envsPath });
  const activeFile = openFiles[0] || null;

  // Seed envs: ensure config field exists; default to null if scenario didn't
  // pre-populate. lineage defaults to [name].
  const seededEnvs = {};
  for (const [name, def] of Object.entries(sc.envs || {})) {
    seededEnvs[name] = {
      ...def,
      config: def.config ?? null,
      deployedSource: def.deployedSource ?? null,
      pendingFrom: def.pendingFrom ?? null,
      lineage: def.lineage ?? [name],
    };
  }

  let s = {
    ...emptyState(),
    scene: "workspace",
    scenarioId,
    repo: { branches, currentBranch },
    envs: seededEnvs,
    promoteEdges: seedEdges,
    activeFile,
    openFiles,
    trace: [
      { at: 1, kind: "scenario-event", text: `scenario ${scenarioId} started`, ts: Date.now() },
    ],
    nextTraceId: 2,
  };
  return recomputeDirectives(s);
}

// envs.json and promotions.json are GLOBAL scenario state (env definitions
// and the promote graph). They are NOT per-branch repo files — the
// structured UIs in the topology sheet are the canonical editors. Earlier
// versions projected them into every branch's file tree, which conflated
// global config with per-branch repo content. Don't.

// ─────────────────────────────────────────────────────────────────────
// Directives
// ─────────────────────────────────────────────────────────────────────

function recomputeDirectives(state) {
  const sc = state.scenarioId ? window.getScenario(state.scenarioId) : null;
  const directives = sc?.directives || [];
  const api = window.makeDirectiveAPI(state);
  const next = {};
  for (const d of directives) {
    let ok = false;
    try { ok = !!d.check(api); } catch { ok = false; }
    next[d.id] = ok ? "satisfied" : "unsatisfied";
  }
  const allSatisfied = directives.length > 0 && directives.every((d) => next[d.id] === "satisfied");
  return { ...state, directiveStates: next, completed: allSatisfied };
}

function appendTrace(state, entry) {
  return {
    ...state,
    trace: [...state.trace, { at: state.nextTraceId, ts: Date.now(), ...entry }],
    nextTraceId: state.nextTraceId + 1,
  };
}

// Read raw text of a file at branch:path.
function readFile(state, branch, path) {
  return state.repo.branches[branch]?.[path] ?? null;
}

// Write a file. Branch must already exist (no branch creation by user).
function writeFile(state, branch, path, content) {
  const b = state.repo.branches[branch];
  if (!b) return state;
  const sc = state.scenarioId ? window.getScenario(state.scenarioId) : null;
  const seed = sc?.branches?.[branch]?.[path];
  const key = window.fileKey(branch, path);
  const dirty = { ...state.dirty, [key]: content !== seed };
  return {
    ...state,
    repo: {
      ...state.repo,
      branches: {
        ...state.repo.branches,
        [branch]: { ...b, [path]: content },
      },
    },
    dirty,
  };
}

// Apply a single promote effect to the state. Returns the new state.
function applyEffect(state, step) {
  switch (step.kind) {
    case "copy-branch": {
      const src = state.repo.branches[step.from];
      if (!src) throw new Error(`copy-branch: source branch missing: ${step.from}`);
      // Deep-copy file map (string contents are immutable).
      const newBranchFiles = { ...src };
      // Also recompute dirty for any files in the target branch that now
      // differ from the scenario seed.
      const sc = state.scenarioId ? window.getScenario(state.scenarioId) : null;
      const seedFiles = sc?.branches?.[step.to] || {};
      const newDirty = { ...state.dirty };
      for (const path of Object.keys(newBranchFiles)) {
        const key = window.fileKey(step.to, path);
        newDirty[key] = newBranchFiles[path] !== seedFiles[path];
      }
      // Drop dirty entries for files that no longer exist on the target.
      const oldTargetFiles = state.repo.branches[step.to] || {};
      for (const path of Object.keys(oldTargetFiles)) {
        if (!(path in newBranchFiles)) {
          delete newDirty[window.fileKey(step.to, path)];
        }
      }
      return {
        ...state,
        repo: {
          ...state.repo,
          branches: { ...state.repo.branches, [step.to]: newBranchFiles },
        },
        dirty: newDirty,
      };
    }
    case "copy-file": {
      const text = readFile(state, step.from.branch, step.from.path);
      if (text === null) throw new Error(`copy-file: source missing: ${step.from.branch}:${step.from.path}`);
      return writeFile(state, step.to.branch, step.to.path, text);
    }
    default:
      throw new Error(`unknown effect kind: ${step.kind}`);
  }
}

// ─────────────────────────────────────────────────────────────────────
// Reducer
// ─────────────────────────────────────────────────────────────────────

function reducer(state, action) {
  switch (action.type) {
    case "LOAD_SCENARIO": {
      const next = makeStateForScenario(action.scenarioId);
      try { localStorage.setItem(STORAGE_LAST_SCENARIO, action.scenarioId); } catch {}
      return next;
    }

    case "SET_SCENE":
      return { ...state, scene: action.scene };

    case "SWITCH_BRANCH": {
      if (!state.repo.branches[action.branch]) return state;
      return { ...state, repo: { ...state.repo, currentBranch: action.branch } };
    }

    case "OPEN_FILE": {
      const { branch, path } = action;
      const exists = state.openFiles.some((f) => f.branch === branch && f.path === path);
      const open = exists ? state.openFiles : [...state.openFiles, { branch, path }];
      return { ...state, activeFile: { branch, path }, openFiles: open };
    }

    case "CLOSE_FILE": {
      const { branch, path } = action;
      const open = state.openFiles.filter((f) => !(f.branch === branch && f.path === path));
      let active = state.activeFile;
      if (active && active.branch === branch && active.path === path) active = open[0] || null;
      return { ...state, openFiles: open, activeFile: active };
    }

    case "EDIT_FILE": {
      const { branch, path, content } = action;
      const next = writeFile(state, branch, path, content);
      return recomputeDirectives(next);
    }

    case "TOGGLE_TOPOLOGY":
      return { ...state, topologyOpen: !state.topologyOpen };

    case "REQUEST_CONFIRM":
      return { ...state, confirm: action.payload };

    case "DISMISS_CONFIRM":
      return { ...state, confirm: null };

    case "SET_ENV_SOURCE": {
      const env = state.envs[action.env];
      if (!env) return state;
      const newSource = { branch: action.source.branch, path: action.source.path };
      const b = state.repo.branches[newSource.branch];
      if (!b || !(newSource.path in b)) return state;
      const newEnvs = {
        ...state.envs,
        [env.name]: { ...env, source: newSource },
      };
      let s2 = { ...state, envs: newEnvs };
      const s3 = appendTrace(s2, {
        kind: "remap",
        text: `remap ${env.name} → ${newSource.branch}:${newSource.path}`,
        env: env.name,
      });
      return recomputeDirectives(s3);
    }

    case "NEW_FILE": {
      const { branch, path, content } = action;
      if (!branch || !path) return state;
      const b = state.repo.branches[branch];
      if (!b) return state;
      if (path in b) return state;  // collision
      if (path === "envs.json" || path === "promotions.json") return state; // managed
      const next = writeFile(state, branch, path, content || "");
      return recomputeDirectives(next);
    }

    case "DELETE_FILE": {
      const { branch, path } = action;
      if (!branch || !path) return state;
      if (path === "envs.json" || path === "promotions.json") return state;
      // Refuse if any env sources from this file.
      const inUse = Object.values(state.envs).some(
        (e) => e.source && e.source.branch === branch && e.source.path === path,
      );
      if (inUse) return state;
      let next = deleteFile(state, branch, path);
      // Close the file if it was open; clear active if it matched.
      const key = window.fileKey(branch, path);
      const newOpen = next.openFiles.filter((f) => !(f.branch === branch && f.path === path));
      let newActive = next.activeFile;
      if (newActive && newActive.branch === branch && newActive.path === path) {
        newActive = newOpen[0] || null;
      }
      const newDirty = { ...next.dirty };
      delete newDirty[key];
      next = { ...next, openFiles: newOpen, activeFile: newActive, dirty: newDirty };
      return recomputeDirectives(next);
    }

    case "NEW_BRANCH": {
      const { name, copyFrom } = action;
      if (!name || typeof name !== "string") return state;
      if (state.repo.branches[name]) return state;  // already exists
      const sourceFiles = copyFrom && state.repo.branches[copyFrom]
        ? deepClone(state.repo.branches[copyFrom])
        : {};
      let s2 = {
        ...state,
        repo: {
          ...state.repo,
          branches: { ...state.repo.branches, [name]: sourceFiles },
        },
      };
      s2 = appendTrace(s2, {
        kind: "repo-edit",
        branch: name,
        path: "(branch)",
        action: "create",
        text: copyFrom ? `branch ${name} created from ${copyFrom}` : `branch ${name} created (empty)`,
      });
      return recomputeDirectives(s2);
    }

    case "DELETE_BRANCH": {
      const { name } = action;
      const branchNames = Object.keys(state.repo.branches);
      if (branchNames.length <= 1) return state;
      if (!state.repo.branches[name]) return state;
      // Refuse if currentBranch or any env sources from it.
      if (state.repo.currentBranch === name) return state;
      const inUse = Object.values(state.envs).some((e) => e.source && e.source.branch === name);
      if (inUse) return state;
      const newBranches = { ...state.repo.branches };
      delete newBranches[name];
      // Close any open files on this branch.
      const newOpen = state.openFiles.filter((f) => f.branch !== name);
      const newActive = state.activeFile && state.activeFile.branch === name ? (newOpen[0] || null) : state.activeFile;
      const newDirty = {};
      for (const [k, v] of Object.entries(state.dirty)) {
        const parsed = window.parseFileKey(k);
        if (parsed && parsed.branch !== name) newDirty[k] = v;
      }
      let s2 = {
        ...state,
        repo: { ...state.repo, branches: newBranches },
        openFiles: newOpen,
        activeFile: newActive,
        dirty: newDirty,
      };
      s2 = appendTrace(s2, {
        kind: "repo-edit",
        branch: name,
        path: "(branch)",
        action: "delete",
        text: `branch ${name} deleted`,
      });
      return recomputeDirectives(s2);
    }

    case "ADD_PROMOTE_EDGE": {
      const { from, to } = action;
      if (!from || !to) return state;
      if (!state.envs[from] || !state.envs[to]) return state;
      // Ensure id uniqueness.
      const baseId = `${from}->${to}`;
      let id = baseId;
      let n = 2;
      while ((state.promoteEdges || []).some((e) => e.id === id)) {
        id = `${baseId}:${n++}`;
      }
      const newEdges = [...(state.promoteEdges || []), { id, from, to, effects: [] }];
      let s2 = { ...state, promoteEdges: newEdges };
      s2 = appendTrace(s2, {
        kind: "promote-graph",
        text: `+ edge ${from} → ${to}`,
      });
      return recomputeDirectives(s2);
    }

    case "REMOVE_PROMOTE_EDGE": {
      const { id } = action;
      const edge = (state.promoteEdges || []).find((e) => e.id === id);
      if (!edge) return state;
      const newEdges = state.promoteEdges.filter((e) => e.id !== id);
      let s2 = { ...state, promoteEdges: newEdges };
      s2 = appendTrace(s2, {
        kind: "promote-graph",
        text: `× edge ${edge.from} → ${edge.to}`,
      });
      return recomputeDirectives(s2);
    }

    case "ADD_PROMOTE_EFFECT": {
      const { edgeId, effect } = action;
      const newEdges = (state.promoteEdges || []).map((e) =>
        e.id === edgeId ? { ...e, effects: [...(e.effects || []), { ...effect }] } : e,
      );
      let s2 = { ...state, promoteEdges: newEdges };
      const edge = newEdges.find((e) => e.id === edgeId);
      s2 = appendTrace(s2, {
        kind: "promote-graph",
        text: `+ effect on ${edge?.from} → ${edge?.to}: ${effect.kind}`,
      });
      return recomputeDirectives(s2);
    }

    case "REMOVE_PROMOTE_EFFECT": {
      const { edgeId, index } = action;
      const newEdges = (state.promoteEdges || []).map((e) => {
        if (e.id !== edgeId) return e;
        const effects = [...(e.effects || [])];
        effects.splice(index, 1);
        return { ...e, effects };
      });
      let s2 = { ...state, promoteEdges: newEdges };
      const edge = newEdges.find((e) => e.id === edgeId);
      s2 = appendTrace(s2, {
        kind: "promote-graph",
        text: `× effect on ${edge?.from} → ${edge?.to}`,
      });
      return recomputeDirectives(s2);
    }

    case "UPDATE_PROMOTE_EFFECT": {
      const { edgeId, index, effect } = action;
      const newEdges = (state.promoteEdges || []).map((e) => {
        if (e.id !== edgeId) return e;
        const effects = [...(e.effects || [])];
        if (index < 0 || index >= effects.length) return e;
        effects[index] = { ...effect };
        return { ...e, effects };
      });
      const s2 = { ...state, promoteEdges: newEdges };
      return recomputeDirectives(s2);
    }

    case "DEPLOY_START": {
      // Mark deploying so the UI can disable the button. The async resolution
      // happens outside the reducer (runtime.jsx).
      return { ...state, deploying: { ...state.deploying, [action.env]: true }, confirm: null };
    }

    case "DEPLOY_RESOLVED": {
      const env = state.envs[action.env];
      if (!env) {
        const next = { ...state, deploying: { ...state.deploying } };
        delete next.deploying[action.env];
        return next;
      }
      const newDeploying = { ...state.deploying };
      delete newDeploying[action.env];
      if (!action.ok) {
        const s2 = appendTrace({ ...state, deploying: newDeploying }, {
          kind: "deploy",
          text: `deploy ${env.name} ✗ — ${action.error}`,
          env: env.name,
          error: true,
        });
        return s2;
      }
      const newVersion = action.derivedVersion;
      const artifactId = `${env.name}-${newVersion}-${Date.now()}`;
      const pending = env.pendingFrom;
      // Lineage extends from a pending promotion if one is staged AND the
      // source text we just deployed matches what was staged. (For .js
      // sources the script text is the comparison key; the resolved config
      // could differ if the script reads other branch files that aren't
      // controlled by the promote effect — that's fine, it just means the
      // participant's promote-then-deploy was honest about the script.)
      const pendingMatches = pending && pending.sourceText === action.sourceText;
      const lineage = pendingMatches
        ? [...pending.lineage, env.name]
        : [env.name];
      const newEnvs = {
        ...state.envs,
        [env.name]: {
          ...env,
          version: newVersion,
          artifactId,
          deployedSource: action.sourceText,
          config: action.value,
          lineage,
          pendingFrom: null,
          lastDeploy: Date.now(),
        },
      };
      const s2 = appendTrace(
        { ...state, envs: newEnvs, deploying: newDeploying },
        {
          kind: "deploy",
          text: `deploy ${env.name} ✓ (${newVersion}${pendingMatches ? `, from ${pending.lineage.join("→")}` : ""})`,
          env: env.name,
        },
      );
      return recomputeDirectives(s2);
    }

    case "PROMOTE": {
      const fromEnv = state.envs[action.from];
      const toEnv = state.envs[action.to];
      if (!fromEnv || !toEnv) return state;

      const sc = state.scenarioId ? window.getScenario(state.scenarioId) : null;

      // Gating: refuse to promote if the source env's deployed config doesn't
      // match the scenario's expected config for its currently-deployed
      // version. Subset match — extras in env.config are fine. If no expected
      // is declared, no gating.
      const fromExpected = sc
        ? window.materializeExpected(sc, window.envIdentityOf(fromEnv), fromEnv.version,
                                     window.expectedCtxFromState(state))
        : null;
      if (fromExpected) {
        const blocking = window.mismatchedExpectedKeys(fromEnv.config, fromExpected);
        if (blocking.length > 0) {
          return appendTrace(state, {
            kind: "promote",
            text: `promote ${action.from} → ${action.to} ✗ blocked — ${action.from}.config doesn't match expected (${blocking.join(", ")})`,
            from: action.from, to: action.to,
            error: true, blocked: true, blockedKeys: blocking,
          });
        }
      }

      // Effects come from state.promoteEdges (participant-editable). When
      // a scenario seeds edges, they're copied into state.promoteEdges at
      // LOAD_SCENARIO time. From then on the participant edits via the
      // topology UI / promotions.json projection.
      const edge = (state.promoteEdges || []).find((e) => e.from === action.from && e.to === action.to);
      const effects = edge?.effects;

      let s2 = { ...state, confirm: null };
      let snapshot;
      const appliedEffects = [];

      if (effects && effects.length > 0) {
        // Apply effects in order. No `when` predicates anymore — effects
        // are pure data and the participant adds/removes them as needed.
        for (const step of effects) {
          try {
            s2 = applyEffect(s2, step);
            appliedEffects.push(step.kind);
          } catch (e) {
            return appendTrace(s2, {
              kind: "promote",
              text: `promote ${fromEnv.name} → ${toEnv.name} ✗ — ${e.message}`,
              from: fromEnv.name, to: toEnv.name, error: true,
            });
          }
        }
        // For lineage matching: snapshot is the to-env's source text AFTER
        // effects have been applied. Subsequent deploy-of-to compares the
        // source text it actually deploys to this snapshot.
        snapshot = readFile(s2, toEnv.source.branch, toEnv.source.path);
      }

      // No effects configured = no-op promote. Record a trace event but
      // don't write any files and don't set pendingFrom — the participant
      // explicitly chose not to wire effects on this edge.
      if (!effects || effects.length === 0) {
        const s3 = appendTrace(s2, {
          kind: "promote",
          text: `promote ${fromEnv.name} → ${toEnv.name} — no effects configured (no-op)`,
          from: fromEnv.name, to: toEnv.name,
        });
        return recomputeDirectives(s3);
      }

      const newEnvs = {
        ...s2.envs,
        [toEnv.name]: {
          ...toEnv,
          pendingFrom: {
            env: fromEnv.name,
            sourceText: snapshot,
            lineage: fromEnv.lineage,
            version: fromEnv.version,
          },
        },
      };
      s2 = { ...s2, envs: newEnvs };
      const effectStr = appliedEffects.length ? ` (${appliedEffects.join(", ")})` : "";
      const s3 = appendTrace(s2, {
        kind: "promote",
        text: `promote ${fromEnv.name} → ${toEnv.name} — staged ${fromEnv.version}${effectStr}, deploy to apply`,
        from: fromEnv.name, to: toEnv.name,
      });
      return recomputeDirectives(s3);
    }

    case "VALIDATE": {
      const s2 = recomputeDirectives(state);
      const sc = s2.scenarioId ? window.getScenario(s2.scenarioId) : null;
      const directives = sc?.directives || [];
      const sat = directives.filter((d) => s2.directiveStates[d.id] === "satisfied").length;
      const allOk = directives.length > 0 && sat === directives.length;
      const s3 = appendTrace(s2, {
        kind: "validate",
        text: allOk
          ? "validate ✓ — all directives satisfied"
          : `validate · ${sat}/${directives.length} satisfied`,
      });
      if (allOk) return { ...s3, scene: "debrief" };
      return s3;
    }

    case "RESET": {
      if (!state.scenarioId) return state;
      try { localStorage.removeItem(storageKeyFor(state.scenarioId)); } catch {}
      return makeStateForScenario(state.scenarioId);
    }

    case "EXIT_TO_INTRO": {
      return { ...emptyState(), scene: "intro" };
    }

    case "ANNOUNCE_REQUIREMENT": {
      // Activates a scenario requirement (e.g. a security advisory). The
      // simulator does NOT mutate any env directly — it just adds the
      // requirement id to state.activeRequirements, which the scenario's
      // expectedConfigFor consults via its ctx arg. The participant then
      // does the operational work (edit files, deploy) to satisfy the new
      // expected. A modal pops up so they can't miss the event.
      if (!action.id) return state;
      const reqs = state.activeRequirements || [];
      const newReqs = reqs.includes(action.id) ? reqs : [...reqs, action.id];
      const pendingAlert = action.alert
        ? { ...action.alert, requirementId: action.id, at: Date.now() }
        : null;
      const s2 = appendTrace({ ...state, activeRequirements: newReqs, pendingAlert }, {
        kind: "advisory",
        text: action.alert?.title
          ? `⚠ ${action.alert.title}`
          : `requirement ${action.id} active`,
        advisoryId: action.id,
      });
      return recomputeDirectives(s2);
    }

    case "DISMISS_ALERT":
      return { ...state, pendingAlert: null };

    case "SHOW_GUIDE":
      return { ...state, guideOpen: true };

    case "HIDE_GUIDE":
      return { ...state, guideOpen: false };

    case "MARK_TRIGGER_FIRED": {
      if (!action.id) return state;
      const fired = state.firedTriggers || [];
      if (fired.includes(action.id)) return state;
      return { ...state, firedTriggers: [...fired, action.id] };
    }

    case "HYDRATE": {
      // Re-fill any fields that aren't in the saved state (e.g. transient
      // fields stripped at persist-time, or fields added in newer code).
      // emptyState() supplies defaults for anything missing.
      const filled = { ...emptyState(), ...action.state };
      return recomputeDirectives(filled);
    }

    default:
      return state;
  }
}

// ─────────────────────────────────────────────────────────────────────
// Trigger runner. Wraps the reducer so scenario-declared triggers fire
// after each action they match. One-shot enforcement via state.firedTriggers
// (ids of triggers already fired).
//
// A trigger:
//   { id: string, when({state, action}) => bool, effect: { kind, ... }, once?: bool }
//
// Effect kinds:
//   - "inject-hotfix": dispatches INJECT_HOTFIX { env, version, configPatch, message? }
//
// The trigger-issued effect action goes back through reducerWithTriggers
// recursively (depth-capped) so cascades work but runaway is prevented.
// ─────────────────────────────────────────────────────────────────────

const TRIGGER_DEPTH_CAP = 8;

function effectToAction(effect) {
  switch (effect.kind) {
    case "announce-requirement":
      return {
        type: "ANNOUNCE_REQUIREMENT",
        id: effect.id,
        alert: effect.alert || null,
      };
    default:
      console.warn("unknown trigger effect kind:", effect.kind);
      return null;
  }
}

function applyTriggers(state, originalAction, depth) {
  if (depth >= TRIGGER_DEPTH_CAP) return state;
  if (!state.scenarioId) return state;
  const sc = window.getScenario(state.scenarioId);
  const triggers = sc?.triggers || [];
  if (triggers.length === 0) return state;
  let s = state;
  for (const t of triggers) {
    if (!t || !t.id) continue;
    if ((s.firedTriggers || []).includes(t.id)) continue;
    let matched = false;
    try {
      matched = !!t.when({ state: s, action: originalAction });
    } catch (e) {
      console.warn("trigger.when threw", t.id, e);
    }
    if (!matched) continue;
    // Mark fired BEFORE dispatching the effect so re-entrant evaluation
    // doesn't re-fire the same trigger.
    s = reducer(s, { type: "MARK_TRIGGER_FIRED", id: t.id });
    const effectAction = effectToAction(t.effect);
    if (effectAction) {
      s = reducer(s, effectAction);
      // The effect action may itself match other triggers — recurse.
      s = applyTriggers(s, effectAction, depth + 1);
    }
  }
  return s;
}

function reducerWithTriggers(state, action) {
  // MARK_TRIGGER_FIRED and effect-actions are themselves dispatched through
  // here recursively from applyTriggers; they shouldn't re-evaluate triggers
  // for themselves (applyTriggers handles cascade explicitly).
  if (action.type === "MARK_TRIGGER_FIRED") return reducer(state, action);
  const next = reducer(state, action);
  if (next === state) return state;  // no-op actions
  return applyTriggers(next, action, 0);
}

// ─────────────────────────────────────────────────────────────────────
// Hook + persistence
// ─────────────────────────────────────────────────────────────────────

function useStore() {
  const [state, dispatch] = React.useReducer(reducerWithTriggers, null, () => emptyState());
  const hydrated = React.useRef(false);
  // Latest-state ref so async helpers (deployEnv) can read the up-to-date
  // state instead of a stale closure capture.
  const stateRef = React.useRef(state);
  React.useEffect(() => { stateRef.current = state; }, [state]);
  const getState = React.useCallback(() => stateRef.current, []);

  // Hydrate once from localStorage.
  React.useEffect(() => {
    try {
      const lastId = localStorage.getItem(STORAGE_LAST_SCENARIO);
      if (lastId) {
        const raw = localStorage.getItem(storageKeyFor(lastId));
        if (raw) {
          const saved = JSON.parse(raw);
          if (saved && saved.__v === SCHEMA_VERSION && saved.state) {
            dispatch({ type: "HYDRATE", state: saved.state });
          }
        }
      }
    } catch (e) { /* ignore */ }
    hydrated.current = true;
  }, []);

  // Persist on change, keyed by current scenarioId. Don't persist the
  // transient `deploying` flag — re-derived on the fly.
  React.useEffect(() => {
    if (!hydrated.current) return;
    if (!state.scenarioId) return;
    try {
      const { deploying, ...persisted } = state;
      localStorage.setItem(
        storageKeyFor(state.scenarioId),
        JSON.stringify({ __v: SCHEMA_VERSION, state: persisted }),
      );
      localStorage.setItem(STORAGE_LAST_SCENARIO, state.scenarioId);
    } catch (e) { /* ignore */ }
  }, [state]);

  return [state, dispatch, getState];
}

Object.assign(window, { useStore, STORAGE_KEY_PREFIX, storageKeyFor });
