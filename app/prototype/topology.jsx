/* global React, window */
// Topology sheet — overlays the workspace. Shows envs as nodes, promote-edges
// between them. Clicking an edge issues a promote (with confirm). Each node
// has a deploy button + a per-env source picker (branch + path).

function TopologySheet({ state, dispatch, getState }) {
  const { envs, directiveStates, repo } = state;
  const sc = state.scenarioId ? window.getScenario(state.scenarioId) : null;
  const nodes = sc?.topologyNodes || {};
  // Edges come from state (participant-editable) once a scenario is loaded.
  // Falls back to the scenario's seed if state hasn't been initialized for
  // edges yet (defensive — should always be initialized via LOAD_SCENARIO).
  const edges = state.promoteEdges && state.promoteEdges.length >= 0
    ? state.promoteEdges
    : (sc?.promoteEdges || []);
  const directives = sc?.directives || [];

  // Defensive: if state isn't fully formed, render nothing and log so we can
  // see how it happened. (Hit during development on certain switch-branch
  // sequences with stale persisted state.)
  if (!repo || !repo.branches || !envs) {
    console.warn("TopologySheet: degenerate state, refusing to render", {
      hasRepo: !!repo,
      hasBranches: !!(repo && repo.branches),
      hasEnvs: !!envs,
      scenarioId: state.scenarioId,
    });
    return null;
  }

  const W = 900, H = 320;

  // Detect "drift". For JSON sources, drift = source.appVersion !== env.version.
  // For JS sources, drift = source script text changed since last deploy.
  const drift = (envName) => {
    const env = envs[envName];
    if (!env || !env.source) return false;
    const branch = repo.branches[env.source.branch];
    if (!branch) return false;
    const text = branch[env.source.path];
    if (text === undefined) return false;
    if (env.source.path.endsWith(".js")) {
      return env.deployedSource !== null && env.deployedSource !== undefined && text !== env.deployedSource;
    }
    const cfg = window.parseConfig(text);
    return !!(cfg && cfg.appVersion !== env.version);
  };

  const close = () => dispatch({ type: "TOGGLE_TOPOLOGY" });

  return (
    <div className="scrim fade-in" onClick={close}>
      <div className="lift" onClick={(e) => e.stopPropagation()}
           style={{
             width: W, background: "var(--panel)",
             border: "1px solid var(--border-strong)",
             borderRadius: 8,
             boxShadow: "0 24px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(106,169,255,0.15)",
             overflow: "hidden",
           }}>
        {/* Sheet header */}
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)",
                      display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontFamily: "var(--mono)", fontSize: 12, fontWeight: 600,
                         letterSpacing: "0.04em" }}>
            environments | promote | deploy
          </span>
          <span style={{ color: "var(--fg-faint)", fontFamily: "var(--mono)", fontSize: 11 }}>
            click an arrow to promote · click deploy on a node to redeploy from source · use the pickers to change a source
          </span>
          <span style={{ flex: 1 }} />
          <button className="btn ghost sm" onClick={close}>esc · close</button>
        </div>

        {/* Canvas */}
        <div className="cb-dots" style={{ position: "relative", height: H, background: "var(--bg)" }}>
          <svg width="100%" height={H} style={{ position: "absolute", inset: 0 }}>
            <defs>
              <marker id="proto-arrow" viewBox="0 0 10 10" refX="9" refY="5"
                      markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0,0 L10,5 L0,10 z" fill="#6aa9ff" />
              </marker>
              <marker id="proto-arrow-good" viewBox="0 0 10 10" refX="9" refY="5"
                      markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0,0 L10,5 L0,10 z" fill="#5ec27e" />
              </marker>
            </defs>
            {edges.map((e) => {
              const a = nodes[e.from], b = nodes[e.to];
              const fromEnv = envs[e.from], toEnv = envs[e.to];
              if (!a || !b || !fromEnv || !toEnv) return null;

              // Gating: blocked if from-env's deployed config doesn't satisfy
              // its expected (per scenario.expectedConfigFor / expectedConfig).
              const fromExpected = sc
                ? window.materializeExpected(sc, window.envIdentityOf(fromEnv), fromEnv.version,
                                             window.expectedCtxFromState(state))
                : null;
              const blockedKeys = fromExpected
                ? window.mismatchedExpectedKeys(fromEnv.config, fromExpected)
                : [];
              const blocked = blockedKeys.length > 0;

              const same = fromEnv.artifactId === toEnv.artifactId
                        && fromEnv.version === toEnv.version
                        && Array.isArray(toEnv.lineage)
                        && toEnv.lineage.includes(e.from);
              const stroke = blocked ? "var(--fg-faint)" : (same ? "#5ec27e" : "#6aa9ff");
              const opacity = blocked ? 0.35 : (same ? 0.85 : 0.6);
              const marker = blocked ? null : (same ? "url(#proto-arrow-good)" : "url(#proto-arrow)");
              const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2 - 22;
              const onPromote = () => {
                if (blocked) return;
                dispatch({ type: "REQUEST_CONFIRM", payload: {
                  kind: "promote", from: e.from, to: e.to,
                  fromVersion: envs[e.from].version,
                  toVersion: envs[e.to].version,
                }});
              };
              const labelText = blocked ? "blocked" : "promote ▸";
              const labelWidth = 76;
              const tooltip = blocked
                ? `${e.from}.config doesn't match expected:\n• ${blockedKeys.join("\n• ")}`
                : `promote ${e.from} → ${e.to}`;
              return (
                <g key={e.id} className="promote-edge"
                   style={{ cursor: blocked ? "not-allowed" : "pointer" }}
                   onClick={onPromote}>
                  <title>{tooltip}</title>
                  <path d={`M${a.x + 64},${a.y} Q${mx},${my} ${b.x - 64},${b.y}`}
                        fill="none" stroke="transparent" strokeWidth="22" />
                  <path d={`M${a.x + 64},${a.y} Q${mx},${my} ${b.x - 64},${b.y}`}
                        fill="none" stroke={stroke} strokeOpacity={opacity}
                        strokeWidth={blocked ? "1.2" : "1.6"}
                        strokeDasharray={blocked ? "4 3" : undefined}
                        markerEnd={marker}
                        style={{ pointerEvents: "none" }} />
                  <rect x={mx - labelWidth/2} y={my - 20} width={labelWidth} height="20" rx="10"
                        fill="var(--panel-2)" stroke={stroke} strokeOpacity={blocked ? 0.4 : 0.5} />
                  <text x={mx} y={my - 6} textAnchor="middle"
                        fill={stroke} fontFamily="var(--mono)"
                        fontSize="10.5" letterSpacing="0.06em"
                        fontWeight="600"
                        style={{ pointerEvents: "none", textTransform: "uppercase" }}>
                    {labelText}
                  </text>
                </g>
              );
            })}
          </svg>

          {Object.entries(nodes).map(([name, p]) => {
            const env = envs[name];
            if (!env) return null;
            const hasDrift = drift(name);
            const isDeploying = !!(state.deploying && state.deploying[name]);
            return (
              <EnvNodeCard key={name}
                           env={env}
                           pos={p}
                           hasDrift={hasDrift}
                           isDeploying={isDeploying}
                           repo={repo}
                           dispatch={dispatch}
                           getState={getState} />
            );
          })}

          <div style={{ position: "absolute", bottom: 12, left: 16,
                        fontFamily: "var(--mono)", fontSize: 11, color: "var(--fg-faint)",
                        display: "flex", gap: 14 }}>
            <span><span className="dot good" /> &nbsp;in sync</span>
            <span><span className="dot warn" /> &nbsp;source ahead of deploy</span>
          </div>
        </div>

        {/* Promote effects editor */}
        <PromoteEffectsEditor state={state} dispatch={dispatch} />

        {/* Directives strip */}
        <div style={{ padding: "12px 18px", borderTop: "1px solid var(--border)",
                      background: "var(--panel-2)" }}>
          <div style={{ fontFamily: "var(--mono)", fontSize: 10,
                        color: "var(--fg-faint)", letterSpacing: "0.12em",
                        textTransform: "uppercase", marginBottom: 8 }}>
            directives
          </div>
          {directives.map((d) => {
            const ok = directiveStates[d.id] === "satisfied";
            return (
              <div key={d.id} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "4px 0",
                fontFamily: "var(--mono)", fontSize: 12,
                color: ok ? "var(--good)" : "var(--fg-dim)",
              }}>
                <span style={{ width: 14, textAlign: "center" }}>{ok ? "✓" : "○"}</span>
                <span style={{ color: "var(--fg-faint)", fontSize: 10, width: 64 }}>
                  {d.kind === "endpoint" ? "endpoint" : "process"}
                </span>
                <span>{d.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Promote effects editor — sits below the env-graph canvas. Lists every
// edge in state.promoteEdges with its effects. Participants can:
//   - add/remove edges
//   - add/remove effects per edge
//   - choose effect kind + parameters
// ─────────────────────────────────────────────────────────────────────

function PromoteEffectsEditor({ state, dispatch }) {
  const edges = state.promoteEdges || [];
  const branchNames = Object.keys(state.repo.branches || {});

  // Promotion edges are scenario-defined (they describe the promotion graph
  // — which envs can promote to which). Participants don't add or remove
  // them; they configure what runs on each edge by adding/removing effects.
  // An edge with no effects is a true no-op — promote records a trace
  // event but doesn't write any files. Configure copy-file or copy-branch
  // effects to make promote actually move things.
  const [adding, setAdding] = React.useState(null);
  // adding: null | { mode: "effect", edgeId }

  return (
    <div style={{ borderTop: "1px solid var(--border)", padding: "10px 18px",
                  background: "var(--panel)" }}>
      <div style={{ marginBottom: 8 }}>
        <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--fg-faint)",
                       letterSpacing: "0.12em", textTransform: "uppercase" }}>
          promote effects
        </span>
      </div>

      {edges.length === 0 && (
        <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--fg-faint)",
                      fontStyle: "italic" }}>
          this scenario declares no promotion paths
        </div>
      )}

      {edges.map((edge) => (
        <EdgeRow key={edge.id} edge={edge}
                 branchNames={branchNames}
                 onRemoveEffect={(idx) => dispatch({
                   type: "REMOVE_PROMOTE_EFFECT", edgeId: edge.id, index: idx,
                 })}
                 onAddEffect={(effect) => dispatch({
                   type: "ADD_PROMOTE_EFFECT", edgeId: edge.id, effect,
                 })}
                 isAdding={adding?.mode === "effect" && adding.edgeId === edge.id}
                 setAdding={setAdding} />
      ))}
    </div>
  );
}

const editorBtnStyle = {
  background: "transparent", border: "1px solid var(--border)",
  borderRadius: 3, color: "var(--fg-dim)",
  fontFamily: "var(--mono)", fontSize: 11, padding: "2px 8px", cursor: "pointer",
};

function EdgeRow({ edge, branchNames, onRemoveEffect, onAddEffect, isAdding, setAdding }) {
  return (
    <div style={{ marginBottom: 8, padding: "6px 8px",
                  background: "var(--bg)", border: "1px solid var(--border)",
                  borderRadius: 4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <span style={{ fontFamily: "var(--mono)", fontSize: 11.5,
                       color: "var(--fg)", fontWeight: 600 }}>
          {edge.from} → {edge.to}
        </span>
        <span style={{ flex: 1 }} />
        <button onClick={() => setAdding({ mode: "effect", edgeId: edge.id })}
                style={editorBtnStyle}>+ effect</button>
      </div>

      {(edge.effects || []).length === 0 && !isAdding && (
        <div style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--fg-faint)",
                      fontStyle: "italic", paddingLeft: 4 }}>
          no effects — promote will be a no-op
        </div>
      )}

      {(edge.effects || []).map((eff, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8,
                              padding: "2px 4px", marginBottom: 1 }}>
          <span style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--fg-dim)",
                         flex: 1 }}>
            {describeEffect(eff)}
          </span>
          <button onClick={() => onRemoveEffect(i)}
                  title="remove this effect"
                  style={{
                    background: "transparent", border: "none", color: "var(--fg-faint)",
                    fontFamily: "var(--mono)", fontSize: 12, padding: "0 4px",
                    cursor: "pointer", opacity: 0.6,
                  }}>×</button>
        </div>
      ))}

      {isAdding && (
        <AddEffectForm branchNames={branchNames}
                       onCancel={() => setAdding(null)}
                       onCreate={(eff) => { onAddEffect(eff); setAdding(null); }} />
      )}
    </div>
  );
}

function describeEffect(eff) {
  if (eff.kind === "copy-file") {
    const f = eff.from || {};
    const t = eff.to || {};
    return `copy-file  ${f.branch || "?"}:${f.path || "?"}  →  ${t.branch || "?"}:${t.path || "?"}`;
  }
  if (eff.kind === "copy-branch") {
    return `copy-branch  ${eff.from || "?"}  →  ${eff.to || "?"}`;
  }
  return `${eff.kind} (unknown)`;
}

function AddEffectForm({ branchNames, onCancel, onCreate }) {
  const [kind, setKind] = React.useState("copy-file");
  const [fromBranch, setFromBranch] = React.useState(branchNames[0] || "");
  const [fromPath, setFromPath] = React.useState("");
  const [toBranch, setToBranch] = React.useState(branchNames[0] || "");
  const [toPath, setToPath] = React.useState("");

  // For copy-branch, fromPath/toPath are unused.
  const submit = () => {
    if (kind === "copy-file") {
      if (!fromBranch || !fromPath || !toBranch || !toPath) return;
      onCreate({ kind, from: { branch: fromBranch, path: fromPath },
                            to:   { branch: toBranch,   path: toPath } });
    } else if (kind === "copy-branch") {
      if (!fromBranch || !toBranch) return;
      onCreate({ kind, from: fromBranch, to: toBranch });
    }
  };

  return (
    <div style={{ marginTop: 6, padding: "8px 10px",
                  background: "var(--bg)", border: "1px dashed var(--border-strong)",
                  borderRadius: 3, display: "flex", flexWrap: "wrap", alignItems: "center",
                  gap: 6, fontFamily: "var(--mono)", fontSize: 10.5 }}>
      <select value={kind} onChange={(e) => setKind(e.target.value)} style={inlineSelectStyle}>
        <option value="copy-file">copy-file</option>
        <option value="copy-branch">copy-branch</option>
      </select>
      {kind === "copy-file" ? (
        <>
          <select value={fromBranch} onChange={(e) => setFromBranch(e.target.value)} style={inlineSelectStyle}>
            {branchNames.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
          <span style={{ color: "var(--fg-faint)" }}>:</span>
          <input value={fromPath} onChange={(e) => setFromPath(e.target.value)}
                 placeholder="from path" style={inlineInputStyle} />
          <span style={{ color: "var(--fg-faint)" }}>→</span>
          <select value={toBranch} onChange={(e) => setToBranch(e.target.value)} style={inlineSelectStyle}>
            {branchNames.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
          <span style={{ color: "var(--fg-faint)" }}>:</span>
          <input value={toPath} onChange={(e) => setToPath(e.target.value)}
                 placeholder="to path" style={inlineInputStyle} />
        </>
      ) : (
        <>
          <select value={fromBranch} onChange={(e) => setFromBranch(e.target.value)} style={inlineSelectStyle}>
            {branchNames.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
          <span style={{ color: "var(--fg-faint)" }}>→</span>
          <select value={toBranch} onChange={(e) => setToBranch(e.target.value)} style={inlineSelectStyle}>
            {branchNames.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </>
      )}
      <span style={{ flex: 1 }} />
      <button style={editorBtnStyle} onClick={onCancel}>cancel</button>
      <button style={{ ...editorBtnStyle, color: "var(--accent)" }} onClick={submit}>add</button>
    </div>
  );
}

const inlineSelectStyle = {
  background: "var(--panel)", color: "var(--fg)",
  border: "1px solid var(--border)", borderRadius: 3,
  fontFamily: "var(--mono)", fontSize: 10.5, padding: "1px 4px",
};

const inlineInputStyle = {
  background: "var(--panel)", color: "var(--fg)",
  border: "1px solid var(--border)", borderRadius: 3,
  fontFamily: "var(--mono)", fontSize: 10.5, padding: "1px 4px",
  width: 120,
};

// ─────────────────────────────────────────────────────────────────────
// Env node card — name, drift dot, version, source picker, deploy button
// ─────────────────────────────────────────────────────────────────────

// Source picker shows files that look like sources: config/*.json or any
// .js (the build script). Excludes envs.json (managed by the picker) and
// the layer files (heterogeneous JSON).
function isSourceCandidatePath(path) {
  if (path === "envs.json") return false;
  return path.endsWith(".js") || window.isConfigPath(path);
}

function EnvNodeCard({ env, pos, hasDrift, isDeploying, repo, dispatch, getState }) {
  // Defensive: if repo or env source isn't well-formed, render a minimal
  // placeholder rather than crashing the whole sheet.
  if (!repo || !repo.branches || !env || !env.source) {
    console.warn("EnvNodeCard: degenerate inputs", { hasRepo: !!repo, env });
    return null;
  }
  const branchNames = Object.keys(repo.branches);
  const pathsOnBranch = Object.keys(repo.branches[env.source.branch] || {})
    .filter(isSourceCandidatePath)
    .sort();

  const onBranchChange = (newBranch) => {
    const candidates = Object.keys(repo.branches[newBranch] || {})
      .filter(isSourceCandidatePath);
    const path = candidates.includes(env.source.path) ? env.source.path : candidates[0];
    if (!path) return;
    dispatch({ type: "SET_ENV_SOURCE", env: env.name, source: { branch: newBranch, path } });
  };
  const onPathChange = (newPath) => {
    dispatch({ type: "SET_ENV_SOURCE", env: env.name, source: { branch: env.source.branch, path: newPath } });
  };

  return (
    <div style={{
      position: "absolute",
      left: pos.x - 78, top: pos.y - 64,
      width: 156, minHeight: 128,
      background: "var(--panel)",
      border: `1px solid ${hasDrift ? "rgba(224,183,92,0.5)" : "var(--border-strong)"}`,
      borderRadius: 6,
      padding: "8px 10px",
      display: "flex", flexDirection: "column",
      boxShadow: "0 1px 0 rgba(0,0,0,0.4)",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontFamily: "var(--mono)", fontSize: 12, fontWeight: 600 }}>
          {env.name}
        </span>
        <span className={`dot ${hasDrift ? "warn" : "good"}`} />
      </div>
      <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--fg-faint)",
                    marginTop: 2, letterSpacing: "0.04em" }}>
        {env.tier} · {env.region}
      </div>
      <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--fg)", marginTop: 6 }}>
        {env.version}
      </div>

      {/* Source pickers */}
      <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 3 }}>
        <select value={env.source.branch}
                onChange={(e) => onBranchChange(e.target.value)}
                title="source branch"
                style={pickerStyle}>
          {branchNames.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
        <select value={env.source.path}
                onChange={(e) => onPathChange(e.target.value)}
                title="source path"
                style={pickerStyle}>
          {pathsOnBranch.length === 0 && <option value="">(no config files on branch)</option>}
          {pathsOnBranch.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      <button className="btn sm primary"
              disabled={isDeploying}
              style={{ marginTop: 6, padding: "2px 6px", fontSize: 10 }}
              onClick={() => {
                const sourceText = repo.branches[env.source.branch]?.[env.source.path];
                const isJs = env.source.path.endsWith(".js");
                const sourceCfg = isJs ? null : window.parseConfig(sourceText);
                dispatch({ type: "REQUEST_CONFIRM", payload: {
                  kind: "deploy", env: env.name,
                  currentVersion: env.version,
                  sourceVersion: sourceCfg?.appVersion ?? (isJs ? "(script)" : "—"),
                }});
              }}>
        {isDeploying ? "deploying…" : "deploy"}
      </button>
    </div>
  );
}

const pickerStyle = {
  background: "var(--bg)", color: "var(--fg)",
  border: "1px solid var(--border)", borderRadius: 3,
  fontFamily: "var(--mono)", fontSize: 10, padding: "2px 4px",
  width: "100%",
};

// ─────────────────────────────────────────────────────────────────────
// Confirm dialog — deploy / promote
// ─────────────────────────────────────────────────────────────────────

function ConfirmDialog({ confirm, dispatch, state, getState }) {
  if (!confirm) return null;
  const close = () => dispatch({ type: "DISMISS_CONFIRM" });

  let title, body, action;
  if (confirm.kind === "deploy") {
    const env = state.envs[confirm.env];
    if (!env) return null;
    const sourceText = state.repo.branches[env.source.branch]?.[env.source.path];
    const isJs = env.source.path.endsWith(".js");
    const sourceCfg = isJs ? null : window.parseConfig(sourceText);
    const willChange = sourceCfg && sourceCfg.appVersion !== env.version;
    title = `Deploy ${confirm.env}?`;
    body = (
      <div style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--fg-dim)", lineHeight: 1.7 }}>
        <div>
          {isJs
            ? <>runs the build script <span style={{ color: "var(--fg)" }}>{env.source.branch}:{env.source.path}</span> with env <span style={{ color: "var(--fg)" }}>{env.name}</span> and applies the resolved config.</>
            : <>reads <span style={{ color: "var(--fg)" }}>{env.source.branch}:{env.source.path}</span> as JSON and applies to <span style={{ color: "var(--fg)" }}>{env.name}</span>.</>}
        </div>
        <div style={{ marginTop: 10, padding: "8px 10px", background: "var(--bg)", borderRadius: 4,
                      border: "1px solid var(--border)" }}>
          <div><span style={{ color: "var(--fg-faint)" }}>now    </span>{env.version}</div>
          <div><span style={{ color: "var(--fg-faint)" }}>after  </span>
            <span style={{ color: willChange ? "#ce9178" : "var(--fg-dim)" }}>
              {isJs ? "(script result, computed on deploy)" : (sourceCfg?.appVersion ?? "(invalid JSON)")}
            </span>
          </div>
        </div>
      </div>
    );
    action = () => {
      dispatch({ type: "DISMISS_CONFIRM" });
      window.deployEnv(getState, dispatch, confirm.env);
    };
  } else if (confirm.kind === "promote") {
    const fromEnv = state.envs[confirm.from];
    const toEnv = state.envs[confirm.to];
    if (!fromEnv || !toEnv) return null;
    const toSourceText = state.repo.branches[toEnv.source.branch]?.[toEnv.source.path];
    title = `Promote ${confirm.from} → ${confirm.to}?`;
    body = (
      <div style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--fg-dim)", lineHeight: 1.7 }}>
        <div>
          stages <span style={{ color: "var(--fg)" }}>{fromEnv.name}</span>'s deployed source{" "}
          (<span style={{ color: "#ce9178" }}>{fromEnv.version}</span>) into{" "}
          <span style={{ color: "var(--fg)" }}>{toEnv.source.branch}:{toEnv.source.path}</span>.
        </div>
        <div style={{ marginTop: 8, color: "var(--warn)", fontSize: 11 }}>
          {toEnv.name} stays deployed at {toEnv.version} until you run deploy {toEnv.name}.
        </div>
        <div style={{ marginTop: 10, padding: "8px 10px", background: "var(--bg)", borderRadius: 4,
                      border: "1px solid var(--border)" }}>
          <div><span style={{ color: "var(--fg-faint)" }}>{toEnv.name} source now    </span>
            {window.parseConfig(toSourceText)?.appVersion ?? "—"}
          </div>
          <div><span style={{ color: "var(--fg-faint)" }}>{toEnv.name} source after  </span>
            <span style={{ color: "#ce9178" }}>{fromEnv.version}</span>
          </div>
          <div style={{ marginTop: 6, fontSize: 10.5, color: "var(--fg-faint)" }}>
            lineage stamp: this artifact will deploy with history{" "}
            {[...fromEnv.lineage, toEnv.name].join(" → ")}
          </div>
        </div>
      </div>
    );
    action = () => dispatch({ type: "PROMOTE", from: confirm.from, to: confirm.to });
  }

  return (
    <div className="scrim fade-in" onClick={close} style={{ zIndex: 60 }}>
      <div className="lift" onClick={(e) => e.stopPropagation()}
           style={{ width: 440, background: "var(--panel)",
                    border: "1px solid var(--border-strong)", borderRadius: 8,
                    boxShadow: "0 24px 60px rgba(0,0,0,0.6)" }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)",
                      fontFamily: "var(--mono)", fontSize: 12, fontWeight: 600 }}>
          {title}
        </div>
        <div style={{ padding: "16px 18px" }}>{body}</div>
        <div style={{ padding: "12px 18px", borderTop: "1px solid var(--border)",
                      display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button className="btn" onClick={close}>cancel</button>
          <button className="btn primary" onClick={action}>
            {confirm.kind === "deploy" ? "deploy" : "promote"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// SecurityAlertModal — pops up when a scenario trigger announces a new
// requirement (e.g. a security advisory). The simulator does NOT mutate
// any env directly — the participant has to do the operational work to
// satisfy the new expected. The modal explains:
//   - what was published / why this is happening (scenario-authored body)
//   - what config is required, and where (scenario-authored)
//   - any forward-looking notes (e.g. "v1.1.0 still requires this value")
// Dismissed via "got it" or Esc.
//
// Alert shape (from scenario.triggers[].effect.alert):
//   {
//     title: string,
//     body: string,
//     requires?: string,        // human-readable description of the required config
//     forward?: string,         // e.g. "v1.1.0 still requires this value"
//     severity?: "security"     // styling hint; default "security"
//   }
// ─────────────────────────────────────────────────────────────────────

function SecurityAlertModal({ alert, dispatch }) {
  if (!alert) return null;
  const close = () => dispatch({ type: "DISMISS_ALERT" });

  return (
    <div className="scrim fade-in" onClick={close} style={{ zIndex: 70 }}>
      <div className="lift" onClick={(e) => e.stopPropagation()}
           style={{ width: 540, background: "var(--panel)",
                    border: "1px solid var(--bad)", borderRadius: 8,
                    boxShadow: "0 24px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(229,115,115,0.25)" }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)",
                      display: "flex", alignItems: "center", gap: 10,
                      background: "rgba(229,115,115,0.06)" }}>
          <span style={{ fontSize: 16 }}>🚨</span>
          <span style={{ fontFamily: "var(--mono)", fontSize: 11, fontWeight: 600,
                         color: "var(--bad)", letterSpacing: "0.14em",
                         textTransform: "uppercase" }}>
            security advisory
          </span>
          <span style={{ marginLeft: 8, fontFamily: "var(--mono)", fontSize: 12,
                         color: "var(--fg)", fontWeight: 600 }}>
            {alert.title}
          </span>
        </div>

        <div style={{ padding: "16px 18px", fontFamily: "var(--mono)",
                      fontSize: 12, color: "var(--fg-dim)", lineHeight: 1.7 }}>
          {alert.body && (
            <div style={{ marginBottom: 14, color: "var(--fg)" }}>
              {alert.body}
            </div>
          )}

          {alert.requires && (
            <>
              <div style={{ marginBottom: 6, color: "var(--fg-faint)",
                            fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase" }}>
                required
              </div>
              <pre style={{ margin: 0, padding: "8px 10px",
                            background: "var(--bg)", border: "1px solid var(--border)",
                            borderRadius: 3, fontSize: 11.5, lineHeight: 1.5,
                            color: "#ce9178", whiteSpace: "pre-wrap",
                            maxHeight: 160, overflow: "auto" }}>
                {alert.requires}
              </pre>
            </>
          )}

          {alert.forward && (
            <div style={{ marginTop: 14, padding: "8px 10px",
                          background: "rgba(224,183,92,0.08)",
                          border: "1px solid rgba(224,183,92,0.25)", borderRadius: 3,
                          fontSize: 11.5, color: "var(--fg-dim)" }}>
              <span style={{ color: "var(--warn)", fontWeight: 600, marginRight: 6 }}>note</span>
              {alert.forward}
            </div>
          )}
        </div>

        <div style={{ padding: "12px 18px", borderTop: "1px solid var(--border)",
                      display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button className="btn primary" onClick={close}>got it</button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { TopologySheet, ConfirmDialog, SecurityAlertModal });
