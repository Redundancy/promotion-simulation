/* global React, window */
// Workspace + Intro + Debrief scenes.

const { useEffect, useMemo } = React;

// ─────────────────────────────────────────────────────────────────────
// Intro — scenario chooser
// ─────────────────────────────────────────────────────────────────────

function IntroScene({ dispatch }) {
  const scenarios = window.listScenarios();

  return (
    <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
                  padding: 40, background: "var(--bg)", overflow: "auto" }}>
      <div style={{ width: 760, maxWidth: "100%", background: "var(--panel)",
                    border: "1px solid var(--border)", borderRadius: 8,
                    boxShadow: "0 24px 60px rgba(0,0,0,0.5)", overflow: "hidden",
                    margin: "auto" }}>
        <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--border)",
                      display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontFamily: "var(--mono)", fontSize: 12, fontWeight: 600,
                         letterSpacing: "0.04em", display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 12, height: 12, border: "1.5px solid var(--accent)", display: "inline-block" }} />
            promotion-simulation
          </span>
          <span style={{ color: "var(--fg-faint)", fontFamily: "var(--mono)", fontSize: 11,
                         paddingLeft: 12, borderLeft: "1px solid var(--border)" }}>
            choose a scenario
          </span>
        </div>

        <div style={{ padding: "24px 24px 28px" }}>
          <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--fg-faint)",
                        letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 14 }}>
            scenarios
          </div>
          {scenarios.length === 0 && (
            <div style={{ color: "var(--bad)", fontFamily: "var(--mono)", fontSize: 12 }}>
              No scenarios are registered.
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {scenarios.map((s) => (
              <button key={s.id}
                      onClick={() => dispatch({ type: "LOAD_SCENARIO", scenarioId: s.id })}
                      style={{
                        textAlign: "left",
                        background: "var(--bg)",
                        border: "1px solid var(--border)",
                        borderRadius: 6,
                        padding: "16px 18px",
                        cursor: "pointer",
                        color: "var(--fg)",
                        fontFamily: "var(--sans)",
                        transition: "border-color 120ms",
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.borderColor = "var(--accent)"}
                      onMouseLeave={(e) => e.currentTarget.style.borderColor = "var(--border)"}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 6 }}>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--accent)",
                                 letterSpacing: "0.04em" }}>{s.id}</span>
                  <span style={{ fontSize: 15, fontWeight: 600 }}>{s.title}</span>
                </div>
                <div style={{ fontSize: 13, color: "var(--fg-dim)", lineHeight: 1.5 }}>
                  {s.summary || s.premise}
                </div>
              </button>
            ))}
          </div>

          <div style={{ marginTop: 20, fontFamily: "var(--mono)", fontSize: 10.5,
                        color: "var(--fg-faint)" }}>
            progress is saved per scenario in localStorage
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Workspace pieces
// ─────────────────────────────────────────────────────────────────────

function FileTree({ state, dispatch }) {
  const branchNames = Object.keys(state.repo.branches);
  const currentBranch = state.repo.currentBranch;
  const branchFiles = state.repo.branches[currentBranch] || {};

  // Group paths by top-level folder.
  const paths = Object.keys(branchFiles).sort();
  const grouped = [];
  const seenFolders = new Set();
  for (const p of paths) {
    const slash = p.indexOf("/");
    if (slash >= 0) {
      const folder = p.slice(0, slash + 1);
      if (!seenFolders.has(folder)) {
        grouped.push({ kind: "folder", name: folder });
        seenFolders.add(folder);
      }
    }
    grouped.push({
      kind: "file",
      name: p,
      ftype: p.endsWith(".js") ? "js" : "json",
    });
  }
  // Move root-level files (no folder) to the top.
  grouped.sort((a, b) => {
    const aRoot = a.kind === "file" && !a.name.includes("/");
    const bRoot = b.kind === "file" && !b.name.includes("/");
    if (aRoot && !bRoot) return -1;
    if (!aRoot && bRoot) return 1;
    return 0;
  });

  const dirtyCount = Object.values(state.dirty).filter(Boolean).length;

  return (
    <div style={{ borderRight: "1px solid var(--border)", background: "var(--panel)",
                  display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
      <div style={{ padding: "8px 14px", background: "var(--panel-2)",
                    borderBottom: "1px solid var(--border)",
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    gap: 8 }}>
        <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--fg-faint)",
                       letterSpacing: "0.12em", textTransform: "uppercase" }}>
          repo
        </span>
        {branchNames.length > 1 ? (
          <select value={currentBranch}
                  onChange={(e) => dispatch({ type: "SWITCH_BRANCH", branch: e.target.value })}
                  style={{
                    background: "var(--panel)", color: "var(--fg)",
                    border: "1px solid var(--border)", borderRadius: 3,
                    fontFamily: "var(--mono)", fontSize: 11, padding: "1px 4px",
                  }}>
            {branchNames.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        ) : (
          <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--fg-dim)",
                         letterSpacing: "0.04em" }}>
            {currentBranch}
          </span>
        )}
        {dirtyCount > 0 && (
          <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--accent)" }}>
            {dirtyCount} edited
          </span>
        )}
      </div>
      <div style={{ padding: "6px 0", overflow: "auto", flex: 1 }}>
        {grouped.map((n, i) => {
          if (n.kind === "folder") {
            return <div key={`folder-${i}`} className="tree-folder">{n.name}</div>;
          }
          const isActive = state.activeFile?.branch === currentBranch
                        && state.activeFile?.path === n.name;
          const label = n.name.includes("/") ? n.name.split("/").pop() : n.name;
          const dirty = !!state.dirty[window.fileKey(currentBranch, n.name)];
          return (
            <div key={n.name} className={`tree-row ${isActive ? "active" : ""}`}
                 onClick={() => dispatch({ type: "OPEN_FILE", branch: currentBranch, path: n.name })}>
              <span className={`ico ${n.ftype}`}>{n.ftype === "json" ? "{}" : "ƒ"}</span>
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {label}
              </span>
              {dirty && <span style={{ color: "var(--accent)" }}>•</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TabStrip({ state, dispatch }) {
  return (
    <div style={{ display: "flex", alignItems: "stretch", background: "var(--panel)",
                  borderBottom: "1px solid var(--border)", height: 34, flex: "none" }}>
      {state.openFiles.map((f) => {
        const isActive = state.activeFile?.branch === f.branch && state.activeFile?.path === f.path;
        const ftype = f.path.endsWith(".js") ? "js" : "json";
        const key = window.fileKey(f.branch, f.path);
        const dirty = !!state.dirty[key];
        const showBranchPrefix = Object.keys(state.repo.branches).length > 1;
        return (
          <div key={key} className={`tab ${isActive ? "active" : ""}`}>
            <span onClick={() => dispatch({ type: "OPEN_FILE", branch: f.branch, path: f.path })}
                  style={{ display: "flex", alignItems: "center", gap: 8, height: "100%" }}>
              <span className={`ico ${ftype}`}>{ftype === "json" ? "{}" : "ƒ"}</span>
              <span>{showBranchPrefix ? `${f.branch}:${f.path}` : f.path}</span>
              {dirty && <span style={{ color: "var(--accent)" }}>•</span>}
            </span>
            <span className="x"
                  onClick={(e) => { e.stopPropagation(); dispatch({ type: "CLOSE_FILE", branch: f.branch, path: f.path }); }}>
              ×
            </span>
          </div>
        );
      })}
      <div style={{ flex: 1, borderBottom: "1px solid var(--border)" }} />
      <span style={{ alignSelf: "center", padding: "0 14px",
                     fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--fg-faint)" }}>
        {state.activeFile?.path?.endsWith(".js") ? "JS" : "JSON"} · {state.activeFile?.branch || "—"}
      </span>
    </div>
  );
}

function Breadcrumb({ activeFile, state }) {
  if (!activeFile) {
    return (
      <div style={{ padding: "8px 18px", borderBottom: "1px solid var(--border)",
                    background: "var(--panel-2)", flex: "none",
                    fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--fg-faint)" }}>
        no file open
      </div>
    );
  }
  const { branch, path } = activeFile;
  const parts = path.split("/");
  const isConfig = window.isConfigPath(path);
  const envName = isConfig ? window.envForSourceLocation(state, branch, path) : null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10,
                  padding: "8px 18px", borderBottom: "1px solid var(--border)",
                  background: "var(--panel-2)", flex: "none" }}>
      <span style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--fg-faint)",
                     letterSpacing: "0.1em", textTransform: "uppercase" }}>
        scope
      </span>
      <span className="tag" style={{ background: "var(--panel-3)", color: "var(--fg-dim)" }}>{branch}</span>
      {parts.length > 1 && (
        <>
          <span style={{ color: "var(--fg-faint)" }}>›</span>
          <span className="tag" style={{ background: "var(--panel-3)", color: "var(--fg-dim)" }}>
            {parts[0]}/
          </span>
        </>
      )}
      <span style={{ color: "var(--fg-faint)" }}>›</span>
      <span className="tag accent">{parts[parts.length - 1]}</span>
      <span style={{ marginLeft: "auto", fontFamily: "var(--mono)", fontSize: 10.5,
                     color: "var(--fg-faint)" }}>
        {envName
          ? <>read by: <span style={{ color: "var(--fg-dim)" }}>1 env ({envName})</span></>
          : path.endsWith(".js")
          ? <>runs on: <span style={{ color: "var(--fg-dim)" }}>every deploy</span></>
          : <>read by: <span style={{ color: "var(--fg-dim)" }}>simulator</span></>}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// ConfigPanes — three stacked JSON pretty-prints showing the env's config
// state at three layers of "currently true":
//
//   • expected     — declared by the scenario; the unambiguous target.
//   • would deploy — what running deploy NOW would apply
//                    (parsed source for JSON sources, or sandbox-resolved
//                    script result for JS sources, debounced on edit).
//   • deployed     — the snapshot from the most recent DEPLOY_RESOLVED.
//
// Per-key diff highlight: the "would deploy" and "deployed" panes color
// keys that differ from expected. The header chip shows "N keys to satisfy"
// (count of keys where deployed ≠ expected).
// ─────────────────────────────────────────────────────────────────────

function ConfigPanes({ env, sourceText, isJsSource, getState }) {
  const sc = env ? window.getScenario(window.useStore ? null : null) : null; // placeholder; we get sc from caller via state below
  // Compute "would deploy" for JSON sources synchronously from sourceText.
  const jsonPreview = React.useMemo(() => {
    if (isJsSource) return null;
    try { return { ok: true, value: JSON.parse(sourceText || "") }; }
    catch (e) { return { ok: false, error: e.message }; }
  }, [isJsSource, sourceText]);

  // For JS sources, run the script (debounced) when sourceText changes.
  const [preview, setPreview] = React.useState({ status: "idle", value: null, error: null });
  React.useEffect(() => {
    if (!isJsSource || !env) { setPreview({ status: "idle", value: null, error: null }); return; }
    let cancelled = false;
    setPreview((p) => ({ ...p, status: "loading" }));
    const t = setTimeout(async () => {
      const result = await window.previewEnv(getState, env.name);
      if (cancelled) return;
      if (result.ok) setPreview({ status: "ok", value: result.value, error: null });
      else setPreview({ status: "error", value: null, error: result.error });
    }, 200);
    return () => { cancelled = true; clearTimeout(t); };
  }, [isJsSource, env?.name, sourceText, getState]);

  const wouldDeploy = isJsSource
    ? (preview.status === "ok" ? { ok: true, value: preview.value }
      : preview.status === "error" ? { ok: false, error: preview.error }
      : preview.status === "loading" ? { loading: true }
      : null)
    : jsonPreview;

  const deployed = env?.config !== null && env?.config !== undefined
    ? { ok: true, value: env.config }
    : { empty: true };

  // Pull the scenario's expected config for this env.
  const scenarioId = getState ? getState().scenarioId : null;
  const scenario = scenarioId ? window.getScenario(scenarioId) : null;
  const expectedValue = scenario?.expectedConfig?.[env?.name];
  const expected = expectedValue !== undefined
    ? { ok: true, value: expectedValue }
    : { undeclared: true };

  // Diffs are computed against expected. (Both deployed and would-deploy.)
  const expectedRef = expected.ok ? expected.value : null;
  const deployedDiff   = computeChangedKeys(deployed.ok   ? deployed.value   : null, expectedRef);
  const wouldDeployDiff = computeChangedKeys(wouldDeploy?.ok ? wouldDeploy.value : null, expectedRef);

  return (
    <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--fg-faint)",
                       letterSpacing: "0.12em", textTransform: "uppercase" }}>
          resolved config
        </span>
        {expected.ok && deployedDiff.length > 0 && (
          <span className="tag warn" style={{ fontSize: 9.5 }}>
            {deployedDiff.length} key{deployedDiff.length === 1 ? "" : "s"} to satisfy
          </span>
        )}
        {expected.ok && deployedDiff.length === 0 && deployed.ok && (
          <span className="tag good" style={{ fontSize: 9.5 }}>matches expected</span>
        )}
      </div>

      <ConfigPane label="expected"
                  result={expected}
                  changedKeys={[]}
                  side="reference" />
      <ConfigPane label="would deploy now"
                  result={wouldDeploy}
                  changedKeys={wouldDeployDiff}
                  side="staged" />
      <ConfigPane label={`deployed${env?.lastDeploy && env.lastDeploy !== "seed" ? ` · ${window.fmtTime(env.lastDeploy)}` : env?.lastDeploy === "seed" ? " · seed" : ""}`}
                  result={deployed}
                  changedKeys={deployedDiff}
                  side="live" />
    </div>
  );
}

function ConfigPane({ label, result, changedKeys, side }) {
  let body;
  if (!result || result.undeclared) {
    body = <span style={{ color: "var(--fg-faint)", fontStyle: "italic" }}>(scenario doesn't declare an expected config for this env)</span>;
  } else if (result.empty) {
    body = <span style={{ color: "var(--fg-faint)", fontStyle: "italic" }}>(not yet deployed)</span>;
  } else if (result.loading) {
    body = <span style={{ color: "var(--fg-faint)", fontStyle: "italic" }}>resolving…</span>;
  } else if (!result.ok) {
    body = <span style={{ color: "var(--bad)" }}>{result.error || "(error)"}</span>;
  } else {
    body = <PrettyJson value={result.value} changedKeys={changedKeys} side={side} />;
  }
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--fg-faint)",
                    letterSpacing: "0.06em", marginBottom: 3 }}>
        {label}
      </div>
      <pre style={{
        margin: 0, padding: "8px 10px",
        background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 3,
        fontFamily: "var(--mono)", fontSize: 11, lineHeight: 1.55,
        color: "var(--fg-dim)", whiteSpace: "pre-wrap", wordBreak: "break-word",
        maxHeight: 180, overflow: "auto",
      }}>
        {body}
      </pre>
    </div>
  );
}

// Pretty-print JSON with top-level changed keys highlighted.
//   side === "reference" → no highlights (this is the source of truth)
//   side === "staged"    → amber for keys that differ from expected
//   side === "live"      → amber for keys that differ from expected
function PrettyJson({ value, changedKeys, side }) {
  if (value === null || value === undefined) return <span style={{ color: "var(--fg-faint)" }}>null</span>;
  if (typeof value !== "object" || Array.isArray(value)) {
    return <span>{JSON.stringify(value, null, 2)}</span>;
  }
  const changedSet = new Set(changedKeys);
  const keys = Object.keys(value);
  const out = ["{"];
  keys.forEach((k, i) => {
    const isLast = i === keys.length - 1;
    const lineKey = JSON.stringify(k);
    const lineVal = JSON.stringify(value[k], null, 2)
      .split("\n")
      .map((line, j) => j === 0 ? line : "  " + line)
      .join("\n");
    out.push({ k, line: `  ${lineKey}: ${lineVal}${isLast ? "" : ","}`, changed: changedSet.has(k) });
  });
  out.push("}");
  return (
    <>
      {out.map((seg, i) => {
        if (typeof seg === "string") return <span key={i}>{seg}{"\n"}</span>;
        const highlight = seg.changed && side !== "reference";
        const color = highlight ? "var(--warn)" : "var(--fg-dim)";
        const bg = highlight ? "rgba(224,183,92,0.10)" : "transparent";
        return (
          <span key={seg.k} style={{ color, background: bg, display: "block" }}>
            {seg.line}
          </span>
        );
      })}
    </>
  );
}

function computeChangedKeys(a, b) {
  if (!a || !b || typeof a !== "object" || typeof b !== "object" || Array.isArray(a) || Array.isArray(b)) return [];
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const changed = [];
  for (const k of keys) {
    if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) changed.push(k);
  }
  return changed;
}

// ─────────────────────────────────────────────────────────────────────

function ImpactRail({ state, getState }) {
  const { activeFile, repo, envs, dirty } = state;
  if (!activeFile) return <div style={{ borderLeft: "1px solid var(--border)", background: "var(--panel)" }} />;
  const sc = state.scenarioId ? window.getScenario(state.scenarioId) : null;
  const directives = sc?.directives || [];
  const envOrder = sc?.envOrder || Object.keys(envs);

  // Identify the env (if any) whose source POINTS AT the file currently open.
  const envName = window.envForSourceLocation(state, activeFile.branch, activeFile.path);
  const env = envName ? envs[envName] : null;
  const sourceText = env ? repo.branches[env.source.branch]?.[env.source.path] : null;
  const isJsSource = env && env.source.path.endsWith(".js");
  let driftHere = false;
  if (env && !isJsSource) {
    const sourceCfg = window.parseConfig(sourceText);
    const sourceVer = sourceCfg?.appVersion;
    driftHere = !!(sourceVer && sourceVer !== env.version);
  } else if (env && isJsSource) {
    driftHere = !!(env.deployedSource && sourceText !== env.deployedSource);
  }

  return (
    <div style={{ borderLeft: "1px solid var(--border)", background: "var(--panel)",
                  display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
      {env ? (
        <>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
            <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--fg-faint)",
                          letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>
              env · {env.name}
            </div>
            <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--fg-dim)", lineHeight: 1.8 }}>
              <div><span style={{ color: "var(--fg-faint)" }}>tier       </span>{env.tier}</div>
              {env.region     && <div><span style={{ color: "var(--fg-faint)" }}>region     </span>{env.region}</div>}
              {env.datacenter && <div><span style={{ color: "var(--fg-faint)" }}>datacenter </span>{env.datacenter}</div>}
              <div><span style={{ color: "var(--fg-faint)" }}>source     </span>{env.source.branch}:{env.source.path}</div>
              <div><span style={{ color: "var(--fg-faint)" }}>last       </span>{window.fmtTime(env.lastDeploy)}</div>
            </div>
          </div>

          <ConfigPanes env={env}
                       sourceText={sourceText}
                       isJsSource={isJsSource}
                       getState={getState} />

          {driftHere && (
            <div style={{ margin: "0 16px 12px", padding: "6px 8px", background: "rgba(224,183,92,0.08)",
                          border: "1px solid rgba(224,183,92,0.2)", borderRadius: 3,
                          fontSize: 10.5, color: "var(--warn)", fontFamily: "var(--mono)" }}>
              {isJsSource
                ? `source script changed since last deploy — run deploy ${env.name} to re-resolve`
                : `source ahead of deploy — run deploy ${env.name} to apply`}
              {dirty[window.fileKey(activeFile.branch, activeFile.path)] && (
                <span className="tag accent" style={{ marginLeft: 8, fontSize: 9.5 }}>unsaved</span>
              )}
            </div>
          )}

          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
            <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--fg-faint)",
                          letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 10 }}>
              all envs
            </div>
            {envOrder.map((n) => {
              const e = envs[n];
              if (!e) return null;
              const here = e.name === env.name;
              return (
                <div key={n} style={{ display: "flex", justifyContent: "space-between",
                                      padding: "6px 0", borderTop: "1px dashed var(--border)",
                                      fontFamily: "var(--mono)", fontSize: 11,
                                      color: here ? "var(--fg)" : "var(--fg-dim)" }}>
                  <span>{e.name}</span>
                  <span>{e.version}</span>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--fg-faint)",
                        letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>
            file info
          </div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 11.5, color: "var(--fg-dim)", lineHeight: 1.7 }}>
            {activeFile.path?.endsWith(".js")
              ? "build script · invoked on every deploy"
              : "scenario metadata"}
          </div>
        </div>
      )}

      <div style={{ padding: "12px 16px", flex: 1, overflow: "auto" }}>
        <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--fg-faint)",
                      letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 10 }}>
          directives
        </div>
        {directives.map((d) => {
          const ok = state.directiveStates[d.id] === "satisfied";
          return (
            <div key={d.id} style={{
              padding: "7px 0", borderTop: "1px dashed var(--border)",
              fontFamily: "var(--mono)", fontSize: 11,
              color: ok ? "var(--good)" : "var(--fg-dim)",
              display: "flex", gap: 8, alignItems: "flex-start",
            }}>
              <span style={{ width: 14, flex: "none", textAlign: "center" }}>{ok ? "✓" : "○"}</span>
              <span>{d.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TopBar({ state, dispatch }) {
  const sc = state.scenarioId ? window.getScenario(state.scenarioId) : null;
  const directives = sc?.directives || [];
  const sat = directives.filter((d) => state.directiveStates[d.id] === "satisfied").length;
  const total = directives.length;
  const allOk = total > 0 && sat === total;
  return (
    <div className="cb-topbar">
      <h1>promotion-simulation</h1>
      <span className="scenario">
        {sc ? `${sc.id} · ${sc.title}` : "—"}
      </span>
      <span className="spacer" />
      <button className="btn"
              title="open the environments / promote / deploy sheet"
              onClick={() => dispatch({ type: "TOGGLE_TOPOLOGY" })}>
        <span style={{ color: "var(--fg)" }}>environments</span>
        <span style={{ color: "var(--fg-faint)", margin: "0 6px" }}>|</span>
        <span style={{ color: "var(--fg)" }}>promote</span>
        <span style={{ color: "var(--fg-faint)", margin: "0 6px" }}>|</span>
        <span style={{ color: "var(--fg)" }}>deploy</span>
      </button>
      <span className={`pill ${allOk ? "good" : "warn"}`}>
        {sat} / {total} directives
      </span>
      <button className="btn primary" onClick={() => dispatch({ type: "VALIDATE" })}>
        validate
      </button>
    </div>
  );
}

function TraceStrip({ state }) {
  const last = state.trace[state.trace.length - 1];
  if (!last) return <div className="trace"><span className="label">trace</span></div>;
  const kindColor = {
    deploy: "var(--accent)",
    promote: "var(--accent)",
    remap: "var(--accent)",
    validate: "var(--good)",
    "scenario-event": "var(--fg-faint)",
  };
  return (
    <div className="trace">
      <span className="label">trace</span>
      <span style={{ color: "var(--fg-faint)" }}>
        #{String(last.at).padStart(3, "0")}
      </span>
      <span style={{ color: kindColor[last.kind] || "var(--fg-dim)" }}>{last.kind}</span>
      <span style={{ color: last.error ? "var(--bad)" : "var(--fg-dim)",
                     overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {last.text}
      </span>
      <span style={{ marginLeft: "auto", color: "var(--fg-faint)" }}>
        {state.trace.length} events · ⌘T sheet
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Workspace
// ─────────────────────────────────────────────────────────────────────

function WorkspaceScene({ state, dispatch, getState }) {
  const activeFile = state.activeFile;
  const isJS = activeFile?.path?.endsWith(".js");
  const isConfig = window.isConfigPath(activeFile?.path);
  const isEnvsJson = activeFile?.path === "envs.json";
  const content = activeFile
    ? (state.repo.branches[activeFile.branch]?.[activeFile.path] ?? "")
    : "";

  const sc = state.scenarioId ? window.getScenario(state.scenarioId) : null;
  const configSchema = sc?.configSchema || null;

  // ⌘T to toggle topology; Esc to close confirm/sheet.
  useEffect(() => {
    const onKey = (e) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "t") {
        e.preventDefault();
        dispatch({ type: "TOGGLE_TOPOLOGY" });
      }
      if (e.key === "Escape") {
        if (state.confirm) dispatch({ type: "DISMISS_CONFIRM" });
        else if (state.topologyOpen) dispatch({ type: "TOGGLE_TOPOLOGY" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dispatch, state.confirm, state.topologyOpen]);

  return (
    <div className="cb" style={{ position: "relative" }}>
      <TopBar state={state} dispatch={dispatch} />

      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "210px 1fr 280px",
                    overflow: "hidden", minHeight: 0 }}>
        <FileTree state={state} dispatch={dispatch} />

        <div style={{ display: "flex", flexDirection: "column", overflow: "hidden",
                      background: "var(--bg)", minWidth: 0 }}>
          <TabStrip state={state} dispatch={dispatch} />
          <Breadcrumb activeFile={activeFile} state={state} />

          <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
            {activeFile && (
              <window.CMEditor
                key={`${activeFile.branch}::${activeFile.path}`}
                value={content}
                language={isJS ? "js" : "json"}
                schema={isConfig ? configSchema : null}
                readOnly={isEnvsJson}
                onChange={(v) => dispatch({
                  type: "EDIT_FILE",
                  branch: activeFile.branch,
                  path: activeFile.path,
                  content: v,
                })}
              />
            )}
          </div>

          <div className="status">
            <span>UTF-8</span>
            <span>LF</span>
            <span>{isJS ? "JavaScript" : "JSON"}</span>
            <span>spaces · 2</span>
            <span style={{ marginLeft: "auto",
                           color: state.dirty[activeFile ? window.fileKey(activeFile.branch, activeFile.path) : ""]
                             ? "var(--accent)" : "var(--good)" }}>
              {(activeFile && state.dirty[window.fileKey(activeFile.branch, activeFile.path)])
                ? "edited · auto-saved"
                : (isEnvsJson ? "read-only" : "clean")}
            </span>
          </div>
        </div>

        <ImpactRail state={state} getState={getState} />
      </div>

      <TraceStrip state={state} />

      {state.topologyOpen && <window.TopologySheet state={state} dispatch={dispatch} getState={getState} />}
      {state.confirm && <window.ConfirmDialog confirm={state.confirm} dispatch={dispatch} state={state} getState={getState} />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Debrief
// ─────────────────────────────────────────────────────────────────────

function DebriefScene({ state, dispatch }) {
  const sc = state.scenarioId ? window.getScenario(state.scenarioId) : null;
  const directives = sc?.directives || [];
  const total = state.trace.filter(t => ["deploy", "promote"].includes(t.kind)).length;
  const deploys  = state.trace.filter(t => t.kind === "deploy").length;
  const promotes = state.trace.filter(t => t.kind === "promote").length;

  return (
    <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
                  padding: 40, background: "var(--bg)", overflow: "auto" }}>
      <div style={{ width: 760, maxWidth: "100%", background: "var(--panel)",
                    border: "1px solid var(--border)", borderRadius: 8,
                    boxShadow: "0 24px 60px rgba(0,0,0,0.5)", overflow: "hidden",
                    margin: "auto" }}>
        <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--border)",
                      display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontFamily: "var(--mono)", fontSize: 12, fontWeight: 600,
                         display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 12, height: 12, background: "var(--good)", display: "inline-block",
                           border: "1.5px solid var(--good)" }} />
            scenario complete
          </span>
          <span style={{ color: "var(--fg-faint)", fontFamily: "var(--mono)", fontSize: 11,
                         paddingLeft: 12, borderLeft: "1px solid var(--border)" }}>
            {sc ? `${sc.id} · ${sc.title}` : "—"}
          </span>
        </div>

        <div style={{ padding: "32px 32px 24px" }}>
          <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--fg-faint)",
                        letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 14 }}>
            directives
          </div>
          {directives.map((d) => (
            <div key={d.id} style={{
              padding: "8px 0", borderTop: "1px dashed var(--border)",
              fontFamily: "var(--mono)", fontSize: 12.5, color: "var(--good)",
              display: "flex", alignItems: "center", gap: 12,
            }}>
              <span style={{ width: 14, textAlign: "center" }}>✓</span>
              <span style={{ color: "var(--fg-faint)", fontSize: 10, width: 64 }}>
                {d.kind}
              </span>
              <span>{d.label}</span>
            </div>
          ))}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 28 }}>
            {[
              { k: "actions",  v: total },
              { k: "deploys",  v: deploys },
              { k: "promotes", v: promotes },
            ].map((s) => (
              <div key={s.k} style={{ padding: "14px 16px", border: "1px solid var(--border)",
                                       borderRadius: 4, background: "var(--bg)" }}>
                <div style={{ fontFamily: "var(--mono)", fontSize: 22, color: "var(--fg)" }}>{s.v}</div>
                <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--fg-faint)",
                              letterSpacing: "0.12em", textTransform: "uppercase", marginTop: 4 }}>
                  {s.k}
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 28, fontFamily: "var(--mono)", fontSize: 10,
                        color: "var(--fg-faint)", letterSpacing: "0.16em", textTransform: "uppercase",
                        marginBottom: 10 }}>
            trace
          </div>
          <div style={{ maxHeight: 180, overflow: "auto", background: "var(--bg)",
                        border: "1px solid var(--border)", borderRadius: 4 }}>
            {state.trace.map((t) => (
              <div key={t.at} style={{
                padding: "5px 14px", fontFamily: "var(--mono)", fontSize: 11,
                color: "var(--fg-dim)", display: "flex", gap: 10,
                borderBottom: "1px dashed var(--border)",
              }}>
                <span style={{ color: "var(--fg-faint)" }}>#{String(t.at).padStart(3, "0")}</span>
                <span style={{ color: t.kind === "validate" ? "var(--good)" : "var(--accent)", width: 70 }}>
                  {t.kind}
                </span>
                <span style={{ color: t.error ? "var(--bad)" : "var(--fg-dim)" }}>{t.text}</span>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 28, display: "flex", gap: 10 }}>
            <button className="btn primary" style={{ padding: "8px 18px", fontSize: 13 }}
                    onClick={() => dispatch({ type: "RESET" })}>
              reset & try again
            </button>
            <button className="btn"
                    onClick={() => dispatch({ type: "SET_SCENE", scene: "workspace" })}>
              back to workspace
            </button>
            <button className="btn"
                    onClick={() => dispatch({ type: "EXIT_TO_INTRO" })}>
              choose another scenario
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { IntroScene, WorkspaceScene, DebriefScene });
