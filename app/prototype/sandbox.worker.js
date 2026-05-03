// Sandbox worker. Runs a participant-authored JS source as a pure function:
//
//   default export:  async function build(env, api): Json
//
// Loaded once per deploy via dynamic import of a Blob URL containing the
// participant's script text. Worker is terminated by the host after the
// script returns (or times out), so no global state survives.
//
// Determinism (per DESIGN.md):
//   - No network: fetch / XHR / WebSocket / importScripts removed.
//   - No clock: Date is replaced with a frozen value.
//   - No randomness: Math.random throws.
//
// Read protocol:
//   worker -> host:  { type: "read", rid, source: { kind: "repo", branch, path } }
//                                   |     "artifact" + { path }   (reserved; not used yet)
//   host -> worker:  { type: "read-response", rid, ok, content?, error? }

const FROZEN_NOW = 0;
const RealDate = Date;
class FrozenDate extends RealDate {
  constructor(...args) {
    if (args.length === 0) super(FROZEN_NOW);
    else super(...args);
  }
  static now() { return FROZEN_NOW; }
}
self.Date = FrozenDate;

self.Math = new Proxy(Math, {
  get(target, prop) {
    if (prop === "random") {
      return () => {
        throw new Error("Math.random is not available in script sources (sandbox is deterministic)");
      };
    }
    return Reflect.get(target, prop);
  },
});

delete self.fetch;
delete self.XMLHttpRequest;
delete self.WebSocket;
delete self.importScripts;

// ─────────────────────────────────────────────────────────────────────
// Read protocol — round-trip to host for repo file reads.
// ─────────────────────────────────────────────────────────────────────

let nextRid = 1;
const pending = new Map();

self.addEventListener("message", (ev) => {
  const msg = ev.data;
  if (msg.type === "read-response") {
    const p = pending.get(msg.rid);
    if (!p) return;
    pending.delete(msg.rid);
    if (msg.ok && msg.content !== undefined) p.resolve(msg.content);
    else p.reject(new Error(msg.error || "read failed"));
    return;
  }
  if (msg.type === "run") {
    runScript(msg).then(
      (value) => self.postMessage({ type: "result", ok: true, value }),
      (err)   => self.postMessage({ type: "result", ok: false, error: err.message, stack: err.stack }),
    );
  }
});

function readFromHost(source) {
  return new Promise((resolve, reject) => {
    const rid = nextRid++;
    pending.set(rid, { resolve, reject });
    self.postMessage({ type: "read", rid, source });
  });
}

// The api passed to the participant's script. `branch` is captured from
// the run message (the script's own branch — scripts can only see their
// own branch, by design).
function makeApi(branch) {
  return Object.freeze({
    async readJson(path) {
      const text = await readFromHost({ kind: "repo", branch, path });
      try { return JSON.parse(text); }
      catch (e) { throw new Error(`readJson(${JSON.stringify(path)}): not valid JSON: ${e.message}`); }
    },
    async readText(path) {
      return readFromHost({ kind: "repo", branch, path });
    },
  });
}

// ─────────────────────────────────────────────────────────────────────
// Script execution.
//
// Participants write a real ES module:
//   export default async function build(env, api) { ... return {...}; }
//
// We assemble a Blob URL containing the script text, dynamically import it
// to get the default export, and invoke it. Round-tripping the return value
// through JSON enforces serialisability and detaches references.
// ─────────────────────────────────────────────────────────────────────

async function runScript({ scriptSource, env, branch }) {
  const blob = new Blob([scriptSource], { type: "text/javascript" });
  const url = URL.createObjectURL(blob);
  let mod;
  try {
    mod = await import(url);
  } catch (e) {
    URL.revokeObjectURL(url);
    throw new Error(`script failed to load: ${e.message}`);
  }
  URL.revokeObjectURL(url);
  if (typeof mod.default !== "function") {
    throw new Error("script must `export default` a function");
  }
  const api = makeApi(branch);
  const result = await mod.default(Object.freeze({ ...env }), api);
  // JSON-roundtrip enforces the script returned a serialisable value.
  try {
    return JSON.parse(JSON.stringify(result));
  } catch (e) {
    throw new Error(`script returned a non-serialisable value: ${e.message}`);
  }
}
