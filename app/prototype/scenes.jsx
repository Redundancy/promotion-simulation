/* global React, window */
// Workspace + Intro + Debrief scenes.

const { useEffect, useMemo } = React;

// ─────────────────────────────────────────────────────────────────────
// Intro — scenario chooser
// ─────────────────────────────────────────────────────────────────────

function IntroScene({ dispatch }) {
  // Two-step: a description page and a scenario chooser. Local state —
  // resets to "landing" on reload, which is fine; one click brings you
  // back to the chooser.
  const [step, setStep] = React.useState("landing");

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
          {step === "chooser" && (
            <button onClick={() => setStep("landing")}
                    style={{
                      background: "transparent", border: 0, padding: 0,
                      color: "var(--fg-faint)", fontFamily: "var(--mono)", fontSize: 11,
                      paddingLeft: 12, borderLeft: "1px solid var(--border)",
                      cursor: "pointer",
                    }}>
              ← back
            </button>
          )}
        </div>

        {step === "landing" ? (
          <IntroLanding onContinue={() => setStep("chooser")} dispatch={dispatch} />
        ) : (
          <IntroChooser dispatch={dispatch} />
        )}
      </div>
    </div>
  );
}

function IntroLanding({ onContinue, dispatch }) {
  return (
    <div style={{ padding: "32px 32px 28px",
                  fontFamily: "var(--sans)", fontSize: 14, lineHeight: 1.65,
                  color: "var(--fg-dim)" }}>
      <p style={{ margin: "0 0 14px" }}>
        A simulator for hands-on practice with configuration management
        across environments.
      </p>
      <p style={{ margin: "0 0 14px" }}>
        When you run several environments — dev, staging, prod,
        sometimes more — configuration tends to duplicate across them.
        A shared value lives in N places, every change to it is N
        edits, and one missed copy quietly leaves an environment
        running the wrong thing. Different strategies contain this:
        shared defaults with per-env overrides, build scripts that
        derive values from each env's identity, branch-per-env
        workflows. The scenarios here introduce them in order.
      </p>
      <p style={{ margin: "0 0 14px" }}>
        Each one hands you a small repository, a few environments with
        pointers into that repository, and a list of directives
        describing what each environment is supposed to be running.
        You edit, deploy, and promote between environments until the
        directives are satisfied. Pick whichever sounds interesting;
        progress is saved per scenario.
      </p>

      <div style={{ marginTop: 26, display: "flex", alignItems: "center",
                    justifyContent: "space-between", gap: 12 }}>
        <button onClick={() => dispatch({ type: "SHOW_GUIDE" })}
                style={{
                  background: "transparent", border: "1px solid var(--border)",
                  borderRadius: 4, padding: "6px 12px",
                  fontFamily: "var(--mono)", fontSize: 11, color: "var(--fg-dim)",
                  cursor: "pointer",
                }}>
          how this works →
        </button>
        <button onClick={onContinue}
                style={{
                  background: "var(--bg)", border: "1px solid var(--accent)",
                  borderRadius: 4, padding: "8px 16px",
                  fontFamily: "var(--mono)", fontSize: 12, fontWeight: 600,
                  color: "var(--fg)",
                  cursor: "pointer",
                }}>
          browse scenarios →
        </button>
      </div>
    </div>
  );
}

function IntroChooser({ dispatch }) {
  const scenarios = window.listScenarios();

  return (
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
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {scenarios.map((s) => (
          <button key={s.id}
                  onClick={() => {
                    // Try to restore saved progress first; fall back to a
                    // fresh start if nothing's saved (or it's the wrong
                    // schema version).
                    let restored = false;
                    try {
                      const raw = localStorage.getItem(window.storageKeyFor(s.id));
                      if (raw) {
                        const saved = JSON.parse(raw);
                        if (saved && saved.__v === 8 && saved.state) {
                          dispatch({ type: "HYDRATE", state: saved.state });
                          restored = true;
                        }
                      }
                    } catch {}
                    if (!restored) dispatch({ type: "LOAD_SCENARIO", scenarioId: s.id });
                  }}
                  style={{
                    textAlign: "left",
                    background: "var(--bg)",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    padding: "12px 14px",
                    cursor: "pointer",
                    color: "var(--fg)",
                    fontFamily: "var(--sans)",
                    transition: "border-color 120ms",
                    display: "flex", alignItems: "baseline", gap: 14,
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = "var(--accent)"}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = "var(--border)"}>
            <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--accent)",
                           letterSpacing: "0.04em", minWidth: 130 }}>{s.id}</span>
            <span style={{ fontSize: 14 }}>{s.title}</span>
          </button>
        ))}
      </div>

      <div style={{ marginTop: 20, fontFamily: "var(--mono)", fontSize: 10.5,
                    color: "var(--fg-faint)" }}>
        progress is saved per scenario in localStorage
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Workspace pieces
// ─────────────────────────────────────────────────────────────────────

// Files that are auto-managed projections. Participants can't create or
// delete them; the topology / source-picker UIs are the canonical editors.
const PROTECTED_FILES = new Set(["envs.json", "promotions.json"]);

function isProtectedFile(path) { return PROTECTED_FILES.has(path); }

function fileInUseByEnv(state, branch, path) {
  return Object.values(state.envs || {}).some(
    (e) => e.source && e.source.branch === branch && e.source.path === path,
  );
}

function branchInUseByEnv(state, branch) {
  return Object.values(state.envs || {}).some(
    (e) => e.source && e.source.branch === branch,
  );
}

// Default content seeded into a new file based on extension.
function defaultContentFor(path) {
  if (path.endsWith(".js")) {
    return `${window.BUILD_JS_DOCS}
export default async function build(env, api) {
  return { env: env.name };
}
`;
  }
  return "{}\n";
}

function FileTree({ state, dispatch }) {
  const [newFileOpen, setNewFileOpen] = React.useState(false);
  const [newBranchOpen, setNewBranchOpen] = React.useState(false);

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
  grouped.sort((a, b) => {
    const aRoot = a.kind === "file" && !a.name.includes("/");
    const bRoot = b.kind === "file" && !b.name.includes("/");
    if (aRoot && !bRoot) return -1;
    if (!aRoot && bRoot) return 1;
    return 0;
  });

  const dirtyCount = Object.values(state.dirty).filter(Boolean).length;

  const headerLabelStyle = {
    fontFamily: "var(--mono)", fontSize: 10, color: "var(--fg-faint)",
    letterSpacing: "0.12em", textTransform: "uppercase",
  };

  const onDeleteFile = (path) => {
    if (isProtectedFile(path)) return;
    if (fileInUseByEnv(state, currentBranch, path)) return;
    if (!confirm(`Delete ${currentBranch}:${path}?`)) return;
    dispatch({ type: "DELETE_FILE", branch: currentBranch, path });
  };

  const onDeleteBranch = (name) => {
    if (branchNames.length <= 1) return;
    if (branchInUseByEnv(state, name)) return;
    if (name === currentBranch) return;
    if (!confirm(`Delete branch ${name}?`)) return;
    dispatch({ type: "DELETE_BRANCH", name });
  };

  return (
    <div style={{ borderRight: "1px solid var(--border)", background: "var(--panel)",
                  display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
      {/* Header */}
      <div style={{ padding: "8px 14px", background: "var(--panel-2)",
                    borderBottom: "1px solid var(--border)",
                    display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={headerLabelStyle}>repo</span>
        {dirtyCount > 0 && (
          <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--accent)" }}>
            {dirtyCount} edited
          </span>
        )}
      </div>

      {/* Branches section */}
      <div style={{ padding: "8px 14px 6px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={headerLabelStyle}>branches</span>
          <button onClick={() => setNewBranchOpen(true)}
                  title="create a new branch"
                  style={{
                    background: "transparent", border: "none", color: "var(--fg-faint)",
                    fontFamily: "var(--mono)", fontSize: 11, cursor: "pointer", padding: "0 2px",
                  }}>+ new</button>
        </div>
        {branchNames.map((b) => {
          const active = b === currentBranch;
          const inUse = branchInUseByEnv(state, b);
          const isLast = branchNames.length === 1;
          const canDelete = !active && !inUse && !isLast;
          const reason = isLast ? "last branch" : active ? "current branch" : inUse ? "in use by an env source" : null;
          return (
            <div key={b}
                 onClick={() => !active && dispatch({ type: "SWITCH_BRANCH", branch: b })}
                 style={{
                   display: "flex", alignItems: "center", gap: 6,
                   padding: "3px 6px", marginBottom: 1,
                   borderRadius: 3, cursor: active ? "default" : "pointer",
                   background: active ? "var(--accent-soft)" : "transparent",
                   borderLeft: active ? "2px solid var(--accent)" : "2px solid transparent",
                 }}>
              <span style={{
                fontFamily: "var(--mono)", fontSize: 11.5, flex: 1,
                color: active ? "var(--fg)" : "var(--fg-dim)",
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}>{b}</span>
              <button onClick={(e) => { e.stopPropagation(); onDeleteBranch(b); }}
                      disabled={!canDelete}
                      title={canDelete ? `delete branch ${b}` : `can't delete: ${reason}`}
                      style={{
                        background: "transparent", border: "none",
                        color: canDelete ? "var(--fg-faint)" : "var(--fg-faint)",
                        opacity: canDelete ? 0.6 : 0.2,
                        fontFamily: "var(--mono)", fontSize: 12, padding: "0 4px",
                        cursor: canDelete ? "pointer" : "not-allowed",
                      }}>×</button>
            </div>
          );
        })}
      </div>

      {/* Files section */}
      <div style={{ padding: "8px 14px 4px",
                    display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={headerLabelStyle}>files on {currentBranch}</span>
        <button onClick={() => setNewFileOpen(true)}
                title="create a new file"
                style={{
                  background: "transparent", border: "none", color: "var(--fg-faint)",
                  fontFamily: "var(--mono)", fontSize: 11, cursor: "pointer", padding: "0 2px",
                }}>+ new</button>
      </div>
      <div style={{ padding: "2px 0 6px", overflow: "auto", flex: 1 }}>
        {grouped.map((n, i) => {
          if (n.kind === "folder") {
            return <div key={`folder-${i}`} className="tree-folder">{n.name}</div>;
          }
          const isActive = state.activeFile?.branch === currentBranch
                        && state.activeFile?.path === n.name;
          const label = n.name.includes("/") ? n.name.split("/").pop() : n.name;
          const dirty = !!state.dirty[window.fileKey(currentBranch, n.name)];
          const protectedFile = isProtectedFile(n.name);
          const inUse = fileInUseByEnv(state, currentBranch, n.name);
          const canDelete = !protectedFile && !inUse;
          const reason = protectedFile ? "auto-managed" : inUse ? "in use by an env source" : null;
          return (
            <div key={n.name} className={`tree-row ${isActive ? "active" : ""}`}
                 style={{ display: "flex", alignItems: "center" }}
                 onClick={() => dispatch({ type: "OPEN_FILE", branch: currentBranch, path: n.name })}>
              <span className={`ico ${n.ftype}`}>{n.ftype === "json" ? "{}" : "ƒ"}</span>
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {label}
              </span>
              {dirty && <span style={{ color: "var(--accent)", marginRight: 4 }}>•</span>}
              <button onClick={(e) => { e.stopPropagation(); onDeleteFile(n.name); }}
                      disabled={!canDelete}
                      className="tree-row-x"
                      title={canDelete ? `delete ${n.name}` : `can't delete: ${reason}`}
                      style={{
                        background: "transparent", border: "none",
                        color: "var(--fg-faint)",
                        opacity: canDelete ? 0.5 : 0.15,
                        fontFamily: "var(--mono)", fontSize: 12, padding: "0 4px",
                        cursor: canDelete ? "pointer" : "not-allowed",
                      }}>×</button>
            </div>
          );
        })}
      </div>

      {newFileOpen && (
        <NewFileModal state={state} branch={currentBranch}
                      onClose={() => setNewFileOpen(false)}
                      onCreate={(path, content) => {
                        dispatch({ type: "NEW_FILE", branch: currentBranch, path, content });
                        dispatch({ type: "OPEN_FILE", branch: currentBranch, path });
                        setNewFileOpen(false);
                      }} />
      )}
      {newBranchOpen && (
        <NewBranchModal state={state}
                        onClose={() => setNewBranchOpen(false)}
                        onCreate={(name, copyFrom) => {
                          dispatch({ type: "NEW_BRANCH", name, copyFrom });
                          dispatch({ type: "SWITCH_BRANCH", branch: name });
                          setNewBranchOpen(false);
                        }} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// New-file modal
// ─────────────────────────────────────────────────────────────────────

function NewFileModal({ state, branch, onClose, onCreate }) {
  const [path, setPath] = React.useState("");
  const [content, setContent] = React.useState("");
  const [touched, setTouched] = React.useState(false);

  const branchFiles = state.repo.branches[branch] || {};

  let error = null;
  if (touched) {
    if (!path) error = "path required";
    else if (path.startsWith("/")) error = "no leading /";
    else if (path in branchFiles) error = "file already exists on this branch";
    else if (isProtectedFile(path)) error = `${path} is auto-managed`;
  }

  const submit = () => {
    setTouched(true);
    if (!path || path.startsWith("/") || path in branchFiles || isProtectedFile(path)) return;
    const c = content || defaultContentFor(path);
    onCreate(path, c);
  };

  // Auto-fill default content when path extension is known and content empty.
  const defaultPreview = path ? defaultContentFor(path) : "";

  return (
    <div className="scrim fade-in" onClick={onClose} style={{ zIndex: 60 }}>
      <div className="lift" onClick={(e) => e.stopPropagation()}
           style={{ width: 480, background: "var(--panel)",
                    border: "1px solid var(--border-strong)", borderRadius: 8,
                    boxShadow: "0 24px 60px rgba(0,0,0,0.6)" }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)",
                      fontFamily: "var(--mono)", fontSize: 12, fontWeight: 600 }}>
          new file on {branch}
        </div>
        <div style={{ padding: "16px 18px", fontFamily: "var(--mono)", fontSize: 12 }}>
          <div style={{ marginBottom: 10 }}>
            <div style={{ color: "var(--fg-faint)", fontSize: 10, marginBottom: 4,
                          letterSpacing: "0.08em", textTransform: "uppercase" }}>path</div>
            <input type="text" value={path}
                   onChange={(e) => { setPath(e.target.value); setTouched(true); }}
                   onKeyDown={(e) => e.key === "Enter" && submit()}
                   placeholder="e.g. config/dev.json or scripts/build.js"
                   autoFocus
                   style={{
                     width: "100%", background: "var(--bg)", color: "var(--fg)",
                     border: "1px solid var(--border)", borderRadius: 3,
                     fontFamily: "var(--mono)", fontSize: 12, padding: "6px 8px",
                   }} />
            {error && (
              <div style={{ color: "var(--bad)", fontSize: 10.5, marginTop: 4 }}>{error}</div>
            )}
          </div>
          <div>
            <div style={{ color: "var(--fg-faint)", fontSize: 10, marginBottom: 4,
                          letterSpacing: "0.08em", textTransform: "uppercase" }}>
              initial content {!content && path && <span style={{ textTransform: "none" }}>(default for {path.endsWith(".js") ? ".js" : ".json"})</span>}
            </div>
            <textarea value={content}
                      onChange={(e) => setContent(e.target.value)}
                      placeholder={defaultPreview}
                      rows={6}
                      style={{
                        width: "100%", background: "var(--bg)", color: "var(--fg)",
                        border: "1px solid var(--border)", borderRadius: 3,
                        fontFamily: "var(--mono)", fontSize: 11.5, padding: "6px 8px",
                        resize: "vertical",
                      }} />
          </div>
        </div>
        <div style={{ padding: "12px 18px", borderTop: "1px solid var(--border)",
                      display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button className="btn" onClick={onClose}>cancel</button>
          <button className="btn primary" onClick={submit}>create</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// New-branch modal
// ─────────────────────────────────────────────────────────────────────

function NewBranchModal({ state, onClose, onCreate }) {
  const branchNames = Object.keys(state.repo.branches);
  const [name, setName] = React.useState("");
  const [copyFrom, setCopyFrom] = React.useState(state.repo.currentBranch || branchNames[0] || "");
  const [empty, setEmpty] = React.useState(false);
  const [touched, setTouched] = React.useState(false);

  let error = null;
  if (touched) {
    if (!name) error = "name required";
    else if (name in state.repo.branches) error = "branch already exists";
    else if (/[/\s]/.test(name)) error = "no slashes or spaces in branch names";
  }

  const submit = () => {
    setTouched(true);
    if (!name || name in state.repo.branches || /[/\s]/.test(name)) return;
    onCreate(name, empty ? null : copyFrom);
  };

  return (
    <div className="scrim fade-in" onClick={onClose} style={{ zIndex: 60 }}>
      <div className="lift" onClick={(e) => e.stopPropagation()}
           style={{ width: 420, background: "var(--panel)",
                    border: "1px solid var(--border-strong)", borderRadius: 8,
                    boxShadow: "0 24px 60px rgba(0,0,0,0.6)" }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)",
                      fontFamily: "var(--mono)", fontSize: 12, fontWeight: 600 }}>
          new branch
        </div>
        <div style={{ padding: "16px 18px", fontFamily: "var(--mono)", fontSize: 12 }}>
          <div style={{ marginBottom: 10 }}>
            <div style={{ color: "var(--fg-faint)", fontSize: 10, marginBottom: 4,
                          letterSpacing: "0.08em", textTransform: "uppercase" }}>name</div>
            <input type="text" value={name}
                   onChange={(e) => { setName(e.target.value); setTouched(true); }}
                   onKeyDown={(e) => e.key === "Enter" && submit()}
                   placeholder="e.g. dev"
                   autoFocus
                   style={{
                     width: "100%", background: "var(--bg)", color: "var(--fg)",
                     border: "1px solid var(--border)", borderRadius: 3,
                     fontFamily: "var(--mono)", fontSize: 12, padding: "6px 8px",
                   }} />
            {error && (
              <div style={{ color: "var(--bad)", fontSize: 10.5, marginTop: 4 }}>{error}</div>
            )}
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6,
                            color: "var(--fg-dim)", fontSize: 11, cursor: "pointer" }}>
              <input type="checkbox" checked={empty} onChange={(e) => setEmpty(e.target.checked)} />
              start empty (no files copied)
            </label>
          </div>
          {!empty && (
            <div>
              <div style={{ color: "var(--fg-faint)", fontSize: 10, marginBottom: 4,
                            letterSpacing: "0.08em", textTransform: "uppercase" }}>copy from</div>
              <select value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)}
                      style={{
                        width: "100%", background: "var(--bg)", color: "var(--fg)",
                        border: "1px solid var(--border)", borderRadius: 3,
                        fontFamily: "var(--mono)", fontSize: 12, padding: "6px 8px",
                      }}>
                {branchNames.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
          )}
        </div>
        <div style={{ padding: "12px 18px", borderTop: "1px solid var(--border)",
                      display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button className="btn" onClick={onClose}>cancel</button>
          <button className="btn primary" onClick={submit}>create</button>
        </div>
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

  // Pull the scenario's expected config for this env at its current version.
  // materializeExpected handles both expectedConfigFor(env, version) and the
  // legacy literal expectedConfig[name] forms.
  const scenarioId = getState ? getState().scenarioId : null;
  const scenario = scenarioId ? window.getScenario(scenarioId) : null;
  const expectedValue = env && scenario
    ? window.materializeExpected(scenario, window.envIdentityOf(env), env.version,
                                 window.expectedCtxFromState(getState ? getState() : null))
    : null;
  const expected = expectedValue !== null && expectedValue !== undefined
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
      <button onClick={() => dispatch({ type: "EXIT_TO_INTRO" })}
              title="back to scenario chooser (your progress is saved)"
              style={{
                background: "transparent", border: "none",
                color: "var(--fg-faint)", fontFamily: "var(--mono)", fontSize: 11,
                cursor: "pointer", padding: "0 8px 0 0",
              }}>
        ← scenarios
      </button>
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
      <button onClick={() => dispatch({ type: "SHOW_INTRO" })}
              title="show the scenario brief"
              style={{
                background: "transparent", border: "1px solid var(--border)",
                borderRadius: 4, color: "var(--fg-dim)",
                fontFamily: "var(--mono)", fontSize: 11, padding: "3px 8px",
                cursor: "pointer",
              }}>
        brief
      </button>
      <button onClick={() => dispatch({ type: "SHOW_GUIDE" })}
              title="how this simulation works"
              style={{
                background: "transparent", border: "1px solid var(--border)",
                borderRadius: 4, color: "var(--fg-dim)",
                fontFamily: "var(--mono)", fontSize: 11, padding: "3px 8px",
                cursor: "pointer",
              }}>
        ? guide
      </button>
      <span className={`pill ${allOk ? "good" : "warn"}`}>
        {sat} / {total} directives
      </span>
      {allOk && (
        <button className="btn primary"
                onClick={() => dispatch({ type: "SET_SCENE", scene: "debrief" })}
                title="all directives satisfied — review the debrief">
          view debrief →
        </button>
      )}
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
        if (state.pendingAlert) dispatch({ type: "DISMISS_ALERT" });
        else if (state.confirm) dispatch({ type: "DISMISS_CONFIRM" });
        else if (state.topologyOpen) dispatch({ type: "TOGGLE_TOPOLOGY" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dispatch, state.confirm, state.topologyOpen, state.pendingAlert]);

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
      {state.pendingAlert && <window.SecurityAlertModal alert={state.pendingAlert} dispatch={dispatch} />}
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

// ─────────────────────────────────────────────────────────────────────
// GuideModal — "how this simulation works". Reachable from the intro
// chooser and from the workspace topbar. Esc dismisses.
// ─────────────────────────────────────────────────────────────────────

function GuideModal({ dispatch }) {
  const close = () => dispatch({ type: "HIDE_GUIDE" });
  const [tab, setTab] = React.useState("overview");

  React.useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const tabs = [
    { id: "overview",   label: "overview" },
    { id: "approaches", label: "approaches to configuration" },
  ];

  return (
    <div className="scrim fade-in" onClick={close} style={{ zIndex: 80 }}>
      <div className="lift" onClick={(e) => e.stopPropagation()}
           style={{ width: 760, maxHeight: "85vh", background: "var(--panel)",
                    border: "1px solid var(--border-strong)", borderRadius: 8,
                    boxShadow: "0 24px 60px rgba(0,0,0,0.6)",
                    display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)",
                      display: "flex", alignItems: "center", gap: 10,
                      background: "var(--panel-2)" }}>
          <span style={{ fontFamily: "var(--mono)", fontSize: 12, fontWeight: 600,
                         letterSpacing: "0.04em" }}>
            how this simulation works
          </span>
          <span style={{ flex: 1 }} />
          <button className="btn ghost sm" onClick={close}>esc · close</button>
        </div>

        <div style={{ display: "flex", gap: 0, padding: "0 16px",
                      borderBottom: "1px solid var(--border)",
                      background: "var(--panel-2)" }}>
          {tabs.map((t) => {
            const active = t.id === tab;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                      style={{
                        appearance: "none", background: "transparent",
                        border: 0, padding: "10px 14px",
                        fontFamily: "var(--mono)", fontSize: 12,
                        cursor: "pointer",
                        color: active ? "var(--fg)" : "var(--fg-dim)",
                        borderBottom: active
                          ? "2px solid var(--accent, #7aa2ff)"
                          : "2px solid transparent",
                        marginBottom: -1,
                      }}>
                {t.label}
              </button>
            );
          })}
        </div>

        <div style={{ padding: "18px 22px 22px", overflow: "auto", flex: 1,
                      fontFamily: "var(--sans)", fontSize: 13.5, lineHeight: 1.6,
                      color: "var(--fg-dim)" }}>

          {tab === "overview" && <GuideOverview />}
          {tab === "approaches" && <GuideApproaches />}

        </div>
      </div>
    </div>
  );
}

function GuideOverview() {
  return (
    <>
          <GuideSection title="What this is">
            <p>You're a platform engineer. You inherit a small repo of configuration, a handful of environments, and some requirements. Your job is to get each environment into the state the requirements describe.</p>
            <p>This is a <em>simulation</em>, not a game. There's no score, no ranking, and no single right answer. Multiple strategies can satisfy the same requirements; the scenarios are designed so you can feel the trade-offs.</p>
          </GuideSection>

          <GuideSection title="Three places to look">
            <ul>
              <li><b>The repo</b> (left panel) — branches, each holding files. You can create and delete branches, create and delete files. Edits to files persist immediately.</li>
              <li><b>The environments</b> (env cards in the <span className="mono">environments | promote | deploy</span> sheet) — each env has a <i>source</i> pointer to a file in the repo. When you press deploy on an env, the simulator runs that source.</li>
              <li><b>The directives</b> (right panel and topbar pill) — the scenario's goals. The pill counts how many you've satisfied.</li>
            </ul>
          </GuideSection>

          <GuideSection title="Two operations">
            <p><b>Deploy</b> runs an env's source.</p>
            <ul>
              <li>If the source is a <span className="mono">.json</span> file, its contents are used as-is.</li>
              <li>If the source is a <span className="mono">.js</span> file, it runs in a sandboxed Web Worker (no network, no clock, no randomness). The script's return value becomes the env's resolved config.</li>
            </ul>
            <p>The result is the env's <i>resolved config</i> — what's "deployed" right now.</p>
            <p><b>Promote</b> moves things between envs by running configured <i>effects</i> on a promotion edge (e.g. <span className="mono">dev → staging</span>).</p>
            <ul>
              <li><span className="mono">copy-file</span> — copy a specific file from one branch/path to another.</li>
              <li><span className="mono">copy-branch</span> — copy ALL files from one branch onto another.</li>
            </ul>
            <p>If an edge has no effects configured, promote does nothing. The scenario seeds the edges (which envs can promote where); you decide what each promote actually does.</p>
          </GuideSection>

          <GuideSection title="Knowing what's expected">
            <p>Click any env's source file to open it in the editor. The right-hand panel shows three stacked panes:</p>
            <ul>
              <li><b>expected</b> — what the scenario says this env's resolved config should look like at its currently-deployed version.</li>
              <li><b>would deploy now</b> — what would happen if you deployed right now (re-resolved from the current source).</li>
              <li><b>deployed</b> — the snapshot from the most recent deploy.</li>
            </ul>
            <p>Keys that don't match the expected pane are highlighted. The chip at the top reads "matches expected" or "N keys to satisfy".</p>
          </GuideSection>

          <GuideSection title="Building your platform">
            <p>The starting state is just a starting point. To shape it to your strategy:</p>
            <ul>
              <li><b>+ new branch</b> in the repo panel creates a branch (optionally copying files from another).</li>
              <li><b>+ new file</b> creates a file on the active branch.</li>
              <li>Each env card has source pickers (branch + path). Repoint them however you like — at a JSON file for direct config, or at a build script for derived values.</li>
              <li>The promote-effects editor (below the env graph) lets you add or remove effects per edge. Configure copy-file / copy-branch effects to suit your strategy, or leave them empty for a no-op promote.</li>
            </ul>
          </GuideSection>

          <GuideSection title="When the world changes mid-flight">
            <p>Scenarios can fire <b>advisories</b> — modal popups that look like ops events ("v1.0.1 was just published, here's what it requires"). When an advisory fires, expected configs may change. Read the advisory carefully; the participant has to do the operational work to bring envs back into compliance.</p>
          </GuideSection>

          <GuideSection title="Tips">
            <ul>
              <li><b>Esc</b> closes modals and the topology sheet.</li>
              <li><b>← scenarios</b> in the topbar returns you to the chooser without losing progress (state is saved per scenario).</li>
              <li>When all directives are satisfied, <b>view debrief →</b> appears in the topbar. The debrief screen shows the trace and offers a reset.</li>
              <li>Run <span className="mono">__reset()</span> in the browser console to nuke the current scenario's saved state.</li>
            </ul>
          </GuideSection>
    </>
  );
}

function GuideApproaches() {
  return (
    <>
      <GuideSection title="Why this section exists">
        <p>There's no single right way to organize configuration across environments. Real platform teams pick from a small toolbox of patterns and combine them. Each pattern has a sweet spot and a failure mode. This section sketches the common ones so you can recognize them in the scenarios — and reach for the right one when you build your own platform.</p>
      </GuideSection>

      <GuideSection title="1. One file per environment (flat)">
        <p>The simplest thing that works: a file like <span className="mono">config/dev.json</span>, <span className="mono">config/staging.json</span>, <span className="mono">config/prod.json</span>. Each env's source points at its own file. Promotion is a <span className="mono">copy-file</span> from one to the next.</p>
        <p><b>Sweet spot:</b> small services, few envs, values that genuinely differ in ad-hoc ways.</p>
        <p><b>Failure mode:</b> shared values get duplicated. A change to a "global" default has to be edited in every file, and it's easy to forget one. Drift between envs becomes invisible.</p>
      </GuideSection>

      <GuideSection title="2. Layered config (defaults + overrides)">
        <p>Split values across layers, most-general to most-specific, and merge at deploy time. Most-specific wins:</p>
        <pre style={{ background: "var(--panel-2)", padding: 10, borderRadius: 4,
                      fontSize: 12, overflow: "auto", margin: "6px 0" }}>
{`defaults.json    →  applies to everything
region/<r>.json  →  overrides for a region
env/<name>.json  →  overrides for one env`}
        </pre>
        <p>A build script reads the layers and returns the merged object. Shared values live once, in <span className="mono">defaults.json</span>; per-env tweaks live in tiny override files.</p>
        <p><b>Sweet spot:</b> multi-region or multi-tier systems where most config is shared and only a handful of values vary per env.</p>
        <p><b>Failure mode:</b> "where does this value come from?" gets harder as layers grow. Override-of-an-override-of-a-default is hard to debug. Mitigated by keeping the merge order short and explicit.</p>
        <p>See <span className="mono">s7-branch-per-env</span> for a worked example with four layers (defaults / region / datacenter / env).</p>
      </GuideSection>

      <GuideSection title="3. Branch per environment">
        <p>Each env gets its own long-lived branch in the repo (<span className="mono">dev</span>, <span className="mono">staging</span>, <span className="mono">prod</span>). Each env's source points at the same path on its own branch — e.g. <span className="mono">dev:build.js</span>, <span className="mono">staging:build.js</span>, <span className="mono">prod:build.js</span>. Promotion is <span className="mono">copy-branch</span>: ship the entire branch state forward.</p>
        <p><b>Sweet spot:</b> teams that want a strong audit trail per env (the branch IS the history of what's deployed there), and approvals on a branch boundary. Plays well with code review on the promotion step.</p>
        <p><b>Failure mode:</b> branches drift if you hand-edit them out of order. The "correct" lineage requires discipline: edit dev, promote dev→staging, promote staging→prod. Hotfixes applied directly on prod are easy to lose on the next promotion.</p>
        <p>See <span className="mono">s7-branch-per-env</span>.</p>
      </GuideSection>

      <GuideSection title="4. Single source of truth + derived envs">
        <p>One file (or one set of files) lives on <span className="mono">main</span>. A build script derives each env's config from that source plus the env's <i>identity</i> (its name, tier, region, etc.). No per-env files at all — the env's identity attributes are the input that produces variation.</p>
        <pre style={{ background: "var(--panel-2)", padding: 10, borderRadius: 4,
                      fontSize: 12, overflow: "auto", margin: "6px 0" }}>
{`// build.js
const base = await api.readJson("config/base.json");
return {
  ...base,
  logLevel: env.tier === "prod" ? "warn" : "debug",
  hostname: \`\${base.serviceName}.\${env.name}.example.com\`,
};`}
        </pre>
        <p><b>Sweet spot:</b> when env differences follow rules ("prod is warn, everything else is debug") rather than ad-hoc preferences. Drift becomes structurally impossible — there's only one file to edit.</p>
        <p><b>Failure mode:</b> the build script becomes a god object. Any new "this one env is special" exception complicates the script. Mitigated by being honest: when an env is genuinely a snowflake, give it its own override file (mix with pattern 2).</p>
      </GuideSection>

      <GuideSection title="5. Derived (composed) values">
        <p>Not a strategy on its own — a technique that combines with the others. Some config values are <i>derived</i> from other values: a hostname composed from <span className="mono">serviceName + env.name + region + rootDomain</span>; a feature-flag set computed from a version number; a connection string composed from host + port + database name.</p>
        <p>Derived values belong in code (a build script), not in JSON. If you put them in JSON you'll forget to update one of them when an input changes; if you derive them, the formula is the source of truth and the value can't drift.</p>
        <p><b>Failure mode:</b> wrong formula, wrong order of inputs, wrong separator. The diff banner highlights it, but the fix is in the script — not the data.</p>
      </GuideSection>

      <GuideSection title="6. Promotion with strict copy semantics">
        <p>Independent of the file layout, the <i>promotion effect</i> shapes how state moves between envs. Two primitives:</p>
        <ul>
          <li><span className="mono">copy-file</span> — surgical: move one file to one location. Use when only one thing should change per promotion (e.g. version bump in <span className="mono">config/prod.json</span>).</li>
          <li><span className="mono">copy-branch</span> — wholesale: ship every file from a branch onto another. Use when the unit of change is "everything that's been merged to the source branch since last promotion".</li>
        </ul>
        <p>An edge with no effects is a no-op promote. That's a valid choice — sometimes you want the promotion graph to express <i>which</i> envs can promote to which others, while leaving the actual move as a manual repo edit.</p>
      </GuideSection>

      <GuideSection title="Mixing and matching">
        <p>Real platforms combine these. A common shape:</p>
        <ul>
          <li>Branch per env (pattern 3) for audit + approval boundaries.</li>
          <li>Layered config (pattern 2) within each branch, so per-env overrides stay tiny.</li>
          <li>Derived values (pattern 5) inside the build script, so hostnames and flag sets can't drift from their inputs.</li>
        </ul>
        <p>The simulator lets you build any combination. The scenarios showcase one pattern each, but nothing forces you to stay inside their starting layout — create branches, write build scripts, change effects, and try a different approach to the same goal.</p>
      </GuideSection>
    </>
  );
}

function GuideSection({ title, children }) {
  return (
    <section style={{ marginBottom: 22 }}>
      <h3 style={{ margin: "0 0 8px",
                   fontFamily: "var(--sans)", fontSize: 14, fontWeight: 600,
                   color: "var(--fg)", letterSpacing: "-0.005em" }}>
        {title}
      </h3>
      <div style={{ paddingLeft: 0 }}>{children}</div>
      <style>{`
        section h3 + div p { margin: 0 0 8px; }
        section h3 + div ul { margin: 4px 0 8px; padding-left: 20px; }
        section h3 + div li { margin-bottom: 4px; }
        section h3 + div .mono { font-family: var(--mono); font-size: 12.5px; }
        section h3 + div b { color: var(--fg); font-weight: 600; }
        section h3 + div em { color: var(--fg); font-style: italic; }
      `}</style>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────
// ScenarioIntroModal — auto-shown on first workspace entry; recallable
// from the topbar via "brief". Renders the scenario's `premise` text.
// ─────────────────────────────────────────────────────────────────────

function ScenarioIntroModal({ state, dispatch }) {
  const close = () => dispatch({ type: "DISMISS_INTRO" });
  const scenario = state.scenarioId ? window.getScenario(state.scenarioId) : null;

  React.useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!scenario) return null;

  return (
    <div className="scrim fade-in" onClick={close} style={{ zIndex: 75 }}>
      <div className="lift" onClick={(e) => e.stopPropagation()}
           style={{ width: 720, maxHeight: "85vh", background: "var(--panel)",
                    border: "1px solid var(--border-strong)", borderRadius: 8,
                    boxShadow: "0 24px 60px rgba(0,0,0,0.6)",
                    display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)",
                      display: "flex", alignItems: "center", gap: 12,
                      background: "var(--panel-2)" }}>
          <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--accent)",
                         letterSpacing: "0.04em" }}>{scenario.id}</span>
          <span style={{ fontFamily: "var(--sans)", fontSize: 14, fontWeight: 600,
                         color: "var(--fg)" }}>
            {scenario.title}
          </span>
          <span style={{ flex: 1 }} />
          <button className="btn ghost sm" onClick={close}>esc · close</button>
        </div>

        <div style={{ padding: "20px 24px 22px", overflow: "auto", flex: 1,
                      fontFamily: "var(--sans)", fontSize: 13.5, lineHeight: 1.65,
                      color: "var(--fg-dim)", whiteSpace: "pre-wrap" }}>
          {scenario.premise || scenario.summary || "(no brief)"}
        </div>

        <div style={{ padding: "12px 20px", borderTop: "1px solid var(--border)",
                      display: "flex", justifyContent: "flex-end",
                      background: "var(--panel-2)" }}>
          <button onClick={close}
                  style={{
                    background: "var(--bg)", border: "1px solid var(--accent)",
                    borderRadius: 4, padding: "6px 14px",
                    fontFamily: "var(--mono)", fontSize: 12, fontWeight: 600,
                    color: "var(--fg)", cursor: "pointer",
                  }}>
            got it
          </button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { IntroScene, WorkspaceScene, DebriefScene, GuideModal, ScenarioIntroModal });
