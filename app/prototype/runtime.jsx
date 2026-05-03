/* global window */
// Async deploy runtime. Owns the sandbox worker lifecycle for JS sources;
// resolves JSON sources synchronously. Returns a uniform { ok, value, error,
// sourceText } so the reducer can apply the result the same way regardless
// of source kind.
//
// Always reads from getState() (a ref-backed accessor) so worker read
// requests see the latest repo state — important if the participant edits
// files while a script is mid-flight (the worker round-trips for each read).

const SCRIPT_TIMEOUT_MS = 3000;

// Identity attributes passed to the script. Anything in the env state object
// not in this blacklist is forwarded as part of `env`.
const ENV_RUNTIME_FIELDS = new Set([
  "source", "version", "artifactId", "lineage",
  "lastDeploy", "deployedSource", "pendingFrom", "config",
]);

function envIdentity(envState) {
  const out = {};
  for (const [k, v] of Object.entries(envState)) {
    if (!ENV_RUNTIME_FIELDS.has(k)) out[k] = v;
  }
  return out;
}

// Resolve an env's source — returns { ok, value, error, sourceText }.
async function resolveEnv(getState, envName) {
  const state = getState();
  const env = state.envs[envName];
  if (!env) return { ok: false, error: `unknown env ${envName}` };
  const branch = env.source.branch;
  const path = env.source.path;
  const sourceText = state.repo.branches[branch]?.[path];
  if (sourceText === undefined) {
    return { ok: false, error: `no such file: ${branch}:${path}`, sourceText: null };
  }
  if (path.endsWith(".js")) {
    const result = await runJsScript(getState, env, sourceText, branch);
    return { ...result, sourceText };
  }
  // JSON source — parse on the spot.
  try {
    return { ok: true, value: JSON.parse(sourceText), sourceText };
  } catch (e) {
    return { ok: false, error: `invalid JSON in ${branch}:${path}: ${e.message}`, sourceText };
  }
}

function runJsScript(getState, env, scriptSource, branch) {
  return new Promise((resolve) => {
    let settled = false;
    let worker;
    try {
      worker = new Worker("./prototype/sandbox.worker.js", { type: "module" });
    } catch (e) {
      resolve({ ok: false, error: `worker failed to start: ${e.message}` });
      return;
    }
    const finish = (r) => {
      if (settled) return;
      settled = true;
      try { worker.terminate(); } catch {}
      resolve(r);
    };
    const timer = setTimeout(() => {
      finish({ ok: false, error: `script timed out after ${SCRIPT_TIMEOUT_MS}ms` });
    }, SCRIPT_TIMEOUT_MS);

    worker.addEventListener("message", (ev) => {
      const msg = ev.data;
      if (msg.type === "read") {
        // Re-read state on every read so we see up-to-the-moment file
        // contents. (Scripts can only see their own branch.)
        const cur = getState();
        const src = msg.source;
        let content, error;
        if (src.kind === "repo") {
          const text = cur.repo.branches[src.branch]?.[src.path];
          if (text === undefined) error = `no such file: ${src.branch}:${src.path}`;
          else content = text;
        } else {
          error = `unsupported read kind: ${src.kind}`;
        }
        worker.postMessage({
          type: "read-response", rid: msg.rid,
          ok: error === undefined, content, error,
        });
        return;
      }
      if (msg.type === "result") {
        clearTimeout(timer);
        if (msg.ok) finish({ ok: true, value: msg.value });
        else finish({ ok: false, error: msg.error });
      }
    });

    worker.addEventListener("error", (ev) => {
      clearTimeout(timer);
      finish({ ok: false, error: ev.message || "worker error" });
    });

    worker.postMessage({
      type: "run",
      scriptSource,
      env: envIdentity(env),
      branch,
    });
  });
}

// Derive a "version" string from a resolved JSON config. Convention:
// prefer .appVersion, then .version, then a short content hash.
function deriveVersion(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    if (typeof value.appVersion === "string") return value.appVersion;
    if (typeof value.version === "string") return value.version;
  }
  return "sha:" + shortHash(JSON.stringify(value));
}

function shortHash(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ("00000000" + (h >>> 0).toString(16)).slice(-8);
}

// Public deploy helper. Use from UI in place of dispatching DEPLOY directly.
async function deployEnv(getState, dispatch, envName) {
  dispatch({ type: "DEPLOY_START", env: envName });
  const result = await resolveEnv(getState, envName);
  dispatch({
    type: "DEPLOY_RESOLVED",
    env: envName,
    ok: result.ok,
    value: result.value ?? null,
    error: result.error ?? null,
    sourceText: result.sourceText ?? null,
    derivedVersion: result.ok ? deriveVersion(result.value) : null,
  });
}

Object.assign(window, {
  resolveEnv, deployEnv, deriveVersion,
});
