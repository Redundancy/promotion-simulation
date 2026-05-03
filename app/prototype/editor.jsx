/* global React */
// Editor: textarea + syntax-tinted overlay + line numbers + JSON-schema
// validation. The textarea is the source of truth; the overlay is read-only
// pretty-printed tokens layered exactly on top so it looks like a tinted
// editor while remaining trivially editable & copy/paste safe.

const { useRef, useState, useEffect, useLayoutEffect, useMemo, useCallback } = React;

// ─────────────────────────────────────────────────────────────────────
// Tokenizers
// ─────────────────────────────────────────────────────────────────────

const C = {
  string:  "#ce9178",
  number:  "#b5cea8",
  bool:    "#569cd6",
  key:     "#9cdcfe",
  punct:   "#d6dae3",
  keyword: "#c586c0",
  fn:      "#dcdcaa",
  comment: "#7a8190",
  fg:      "#d6dae3",
};

function tokenizeJSON(src) {
  // Walk char-by-char, recognizing strings (with key vs value distinction
  // by checking for a trailing `:` after whitespace), numbers, true/false/null.
  const out = [];
  let i = 0;
  const push = (text, color) => { if (text) out.push({ text, color }); };

  while (i < src.length) {
    const ch = src[i];
    if (ch === '"') {
      // string — scan to closing quote
      let j = i + 1;
      while (j < src.length && src[j] !== '"') {
        if (src[j] === "\\") j += 2; else j += 1;
      }
      const str = src.slice(i, Math.min(j + 1, src.length));
      // Is this a key? Look ahead past whitespace for ':'
      let k = j + 1;
      while (k < src.length && /\s/.test(src[k])) k++;
      const isKey = src[k] === ":";
      push(str, isKey ? C.key : C.string);
      i = j + 1;
      continue;
    }
    if (/[-\d]/.test(ch)) {
      const m = src.slice(i).match(/^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/);
      if (m) { push(m[0], C.number); i += m[0].length; continue; }
    }
    if (/[a-z]/.test(ch)) {
      const m = src.slice(i).match(/^(true|false|null)/);
      if (m) { push(m[0], C.bool); i += m[0].length; continue; }
    }
    push(ch, C.fg);
    i += 1;
  }
  return out;
}

function tokenizeJS(src) {
  const KEYWORDS = new Set(["export","default","function","return","const","let","var","if","else","for","while","throw","new","import","from","async","await","try","catch","switch","case","break","continue","class","extends","this"]);
  const LITERALS = new Set(["true","false","null","undefined"]);
  const out = [];
  let i = 0;
  const push = (text, color) => { if (text) out.push({ text, color }); };

  while (i < src.length) {
    const rest = src.slice(i);
    // line comment
    let m;
    if ((m = rest.match(/^\/\/.*/))) { push(m[0], C.comment); i += m[0].length; continue; }
    // block comment
    if ((m = rest.match(/^\/\*[\s\S]*?\*\//))) { push(m[0], C.comment); i += m[0].length; continue; }
    // string
    if ((m = rest.match(/^("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)/))) {
      push(m[0], C.string); i += m[0].length; continue;
    }
    // number
    if ((m = rest.match(/^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/))) {
      push(m[0], C.number); i += m[0].length; continue;
    }
    // identifier
    if ((m = rest.match(/^[A-Za-z_$][\w$]*/))) {
      const w = m[0];
      const after = src[i + w.length];
      let color = C.fg;
      if (KEYWORDS.has(w)) color = C.keyword;
      else if (LITERALS.has(w)) color = C.bool;
      else if (after === "(") color = C.fn;
      push(w, color); i += w.length; continue;
    }
    push(src[i], C.fg);
    i += 1;
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────
// Schema validation
// ─────────────────────────────────────────────────────────────────────

function validateAgainstSchema(text, schema) {
  const issues = [];
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    const msg = err.message;
    const lineMatch = /line\s+(\d+)/i.exec(msg);
    const colMatch  = /column\s+(\d+)/i.exec(msg);
    const posMatch  = /position\s+(\d+)/.exec(msg);
    let line = 1;
    if (lineMatch) line = parseInt(lineMatch[1]);
    else if (posMatch) {
      const pos = parseInt(posMatch[1]);
      line = (text.slice(0, pos).match(/\n/g) || []).length + 1;
    }
    issues.push({ line, severity: "error", message: msg });
    return issues;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    issues.push({ line: 1, severity: "error", message: "expected JSON object" });
    return issues;
  }
  for (const k of (schema.required || [])) {
    if (!(k in parsed)) {
      issues.push({ line: 1, severity: "error", message: `missing required key "${k}"` });
    }
  }
  for (const [k, v] of Object.entries(parsed)) {
    const propSpec = schema.properties?.[k];
    const lineOfKey = lineForKey(text, k) || 1;
    if (!propSpec) {
      if (schema.additionalProperties === false) {
        issues.push({ line: lineOfKey, severity: "warning", message: `unknown key "${k}"` });
      }
      continue;
    }
    if (propSpec.type === "string" && typeof v !== "string") {
      issues.push({ line: lineOfKey, severity: "error", message: `"${k}" must be a string` });
    }
    if (propSpec.pattern && typeof v === "string" && !new RegExp(propSpec.pattern).test(v)) {
      issues.push({
        line: lineOfKey, severity: "error",
        message: `"${k}" must match ${propSpec.pattern} — e.g. "v1.0.0"`,
      });
    }
  }
  return issues;
}

function lineForKey(text, key) {
  const re = new RegExp(`"${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`);
  const m = re.exec(text);
  if (!m) return null;
  return (text.slice(0, m.index).match(/\n/g) || []).length + 1;
}

// ─────────────────────────────────────────────────────────────────────
// Editor component
// ─────────────────────────────────────────────────────────────────────

function CMEditor({ value, onChange, language, schema, readOnly }) {
  const taRef       = useRef(null);
  const overlayRef  = useRef(null);
  const gutterRef   = useRef(null);
  const wrapperRef  = useRef(null);

  // Re-render overlay when value changes
  const tokens = useMemo(() => {
    if (language === "js") return tokenizeJS(value || "");
    return tokenizeJSON(value || "");
  }, [value, language]);

  const lines = useMemo(() => (value || "").split("\n"), [value]);

  const issues = useMemo(() => {
    if (language !== "json" || !schema) return [];
    return validateAgainstSchema(value || "", schema);
  }, [value, language, schema]);

  // Sync scroll between textarea and overlay/gutter
  const onScroll = useCallback(() => {
    const ta = taRef.current;
    if (!ta) return;
    if (overlayRef.current) {
      overlayRef.current.scrollTop = ta.scrollTop;
      overlayRef.current.scrollLeft = ta.scrollLeft;
    }
    if (gutterRef.current) {
      gutterRef.current.scrollTop = ta.scrollTop;
    }
  }, []);

  // Track active line for highlight
  const [activeLine, setActiveLine] = useState(1);
  const updateActive = useCallback(() => {
    const ta = taRef.current;
    if (!ta) return;
    const before = ta.value.slice(0, ta.selectionStart);
    setActiveLine((before.match(/\n/g) || []).length + 1);
  }, []);

  // Tab handling
  const onKeyDown = useCallback((e) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const ta = taRef.current;
      const start = ta.selectionStart;
      const end   = ta.selectionEnd;
      const next  = ta.value.slice(0, start) + "  " + ta.value.slice(end);
      onChange && onChange(next);
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + 2;
      });
    }
  }, [onChange]);

  return (
    <div ref={wrapperRef} style={{
      position: "relative", height: "100%", width: "100%",
      display: "flex", overflow: "hidden", background: "var(--bg)",
    }}>
      {/* Gutter */}
      <div ref={gutterRef} style={{
        flex: "none", width: 56, paddingTop: 14, paddingBottom: 14,
        textAlign: "right",
        fontFamily: "var(--mono)", fontSize: 13, lineHeight: "22px",
        color: "var(--fg-faint)",
        borderRight: "1px solid var(--border)",
        userSelect: "none", overflow: "hidden",
      }}>
        {lines.map((_, i) => {
          const ln = i + 1;
          const issue = issues.find(x => x.line === ln);
          const here  = ln === activeLine;
          return (
            <div key={ln} style={{
              padding: "0 14px 0 0",
              color: here ? "var(--fg)" : (issue ? "var(--bad)" : "var(--fg-faint)"),
              background: here ? "var(--panel-2)" : "transparent",
              position: "relative",
            }}>
              {ln}
              {issue && (
                <span style={{
                  position: "absolute", left: 4, top: 4,
                  width: 6, height: 6, borderRadius: "50%",
                  background: issue.severity === "error" ? "var(--bad)" : "var(--warn)",
                }} />
              )}
            </div>
          );
        })}
      </div>

      {/* Code surface — overlay (tinted) + textarea (transparent text, real focus) */}
      <div style={{ position: "relative", flex: 1, minWidth: 0, overflow: "hidden" }}>
        {/* Active-line highlight strip */}
        <div style={{
          position: "absolute", left: 0, right: 0,
          top: (activeLine - 1) * 22 + 14 - (taRef.current?.scrollTop || 0),
          height: 22,
          background: "rgba(106,169,255,0.06)",
          pointerEvents: "none",
        }} />

        {/* Tinted overlay (pre) — same paddings, fonts, line-height as textarea */}
        <pre ref={overlayRef} aria-hidden="true" style={{
          position: "absolute", inset: 0, margin: 0,
          padding: "14px 18px",
          fontFamily: "var(--mono)", fontSize: 13.5, lineHeight: "22px",
          whiteSpace: "pre",
          color: "var(--fg)",
          overflow: "hidden",
          pointerEvents: "none",
          background: "transparent",
        }}>
          {tokens.map((t, i) => (
            <span key={i} style={{ color: t.color }}>{t.text}</span>
          ))}
          {/* Trailing newline so empty last line still has height */}
          {"\n"}
        </pre>

        {/* Real textarea — transparent text, visible caret */}
        <textarea
          ref={taRef}
          value={value || ""}
          spellCheck={false}
          readOnly={!!readOnly}
          onScroll={onScroll}
          onChange={(e) => onChange && onChange(e.target.value)}
          onKeyDown={onKeyDown}
          onKeyUp={updateActive}
          onClick={updateActive}
          onSelect={updateActive}
          style={{
            position: "absolute", inset: 0,
            width: "100%", height: "100%",
            padding: "14px 18px",
            margin: 0, border: "none", outline: "none", resize: "none",
            background: "transparent",
            color: "transparent",
            caretColor: "var(--accent)",
            fontFamily: "var(--mono)", fontSize: 13.5, lineHeight: "22px",
            whiteSpace: "pre",
            tabSize: 2,
            overflowWrap: "normal",
            overflow: "auto",
            // hide the textarea's own selection color so the overlay shows
            // selection via a subtle layer through 'selection' below
          }}
        />

        <style>{`
          textarea::selection { background: rgba(106,169,255,0.22); color: transparent; }
        `}</style>
      </div>

      {/* Inline diagnostic strip — hovered/clicked from gutter dots */}
      {issues.length > 0 && (
        <div style={{
          position: "absolute", bottom: 0, left: 56, right: 0,
          background: "rgba(229,115,115,0.08)",
          borderTop: "1px solid rgba(229,115,115,0.25)",
          padding: "5px 14px",
          fontFamily: "var(--mono)", fontSize: 11,
          color: "var(--bad)",
          display: "flex", alignItems: "center", gap: 12,
          maxHeight: 60, overflow: "auto",
        }}>
          <span style={{ flex: "none", color: "var(--bad)", letterSpacing: "0.06em" }}>
            ✕ {issues.length} {issues.length === 1 ? "issue" : "issues"}
          </span>
          <span style={{ color: "var(--fg-dim)" }}>
            line {issues[0].line} · {issues[0].message}
          </span>
        </div>
      )}
    </div>
  );
}

Object.assign(window, { CMEditor, validateAgainstSchema });
