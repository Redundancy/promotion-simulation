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

const STORAGE_KEY_PREFIX = "sim-prototype.v3";
const STORAGE_LAST_SCENARIO = "sim-prototype.v3.lastScenario";
const SCHEMA_VERSION = 3;

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
    deploying: {},
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
    activeFile,
    openFiles,
    trace: [
      { at: 1, kind: "scenario-event", text: `scenario ${scenarioId} started`, ts: Date.now() },
    ],
    nextTraceId: 2,
  };
  return recomputeDirectives(s);
}

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
      const sc = state.scenarioId ? window.getScenario(state.scenarioId) : null;
      const envsText = window.renderEnvsJson(newEnvs, sc?.envOrder);
      let s2 = {
        ...state,
        envs: newEnvs,
        repo: {
          ...state.repo,
          branches: {
            ...state.repo.branches,
            [state.repo.currentBranch]: {
              ...state.repo.branches[state.repo.currentBranch],
              "envs.json": envsText,
            },
          },
        },
      };
      const seed = sc?.branches?.[state.repo.currentBranch]?.["envs.json"];
      s2.dirty = { ...s2.dirty, [window.fileKey(state.repo.currentBranch, "envs.json")]: envsText !== seed };
      const s3 = appendTrace(s2, {
        kind: "remap",
        text: `remap ${env.name} → ${newSource.branch}:${newSource.path}`,
        env: env.name,
      });
      return recomputeDirectives(s3);
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

      // Look up scenario-declared effects on the edge.
      const sc = state.scenarioId ? window.getScenario(state.scenarioId) : null;
      const edge = (sc?.promoteEdges || []).find((e) => e.from === action.from && e.to === action.to);
      const effects = edge?.effects;

      let s2 = { ...state, confirm: null };
      let snapshot;
      const appliedEffects = [];

      if (effects && effects.length > 0) {
        // Apply scenario-declared effects.
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
      } else {
        // Default: snapshot from-env's deployed source text into to-env's
        // source-file path.
        snapshot = fromEnv.deployedSource ?? readFile(state, fromEnv.source.branch, fromEnv.source.path);
        if (snapshot !== null) {
          s2 = writeFile(s2, toEnv.source.branch, toEnv.source.path, snapshot);
          appliedEffects.push("copy-source-text");
        }
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

    case "HYDRATE":
      return recomputeDirectives(action.state);

    default:
      return state;
  }
}

// ─────────────────────────────────────────────────────────────────────
// Hook + persistence
// ─────────────────────────────────────────────────────────────────────

function useStore() {
  const [state, dispatch] = React.useReducer(reducer, null, () => emptyState());
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
