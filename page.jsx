/* global React, ReactDOM */
const { useEffect } = React;

// ---------- Page ----------

function Page({ tweaks, setTweak }) {
  return (
    <>
      <Topbar appUrl={tweaks.appUrl} repoUrl={tweaks.repoUrl} />
      <main className="container" style={{ paddingTop: 96, paddingBottom: 96 }}>
        <Card appUrl={tweaks.appUrl} />
      </main>
      <TweaksUI tweaks={tweaks} setTweak={setTweak} />
    </>
  );
}

// ---------- Topbar ----------

function Topbar({ appUrl, repoUrl }) {
  return (
    <div className="topbar">
      <div className="container topbar-inner">
        <div className="brand">
          <span className="brand-mark" />
          <span>promotion-simulation</span>
        </div>
        <nav className="topbar-nav">
          <a href={repoUrl} target="_blank" rel="noreferrer">repo&nbsp;↗</a>
          <a href={appUrl} style={{ color: "var(--accent)" }}>launch&nbsp;→</a>
        </nav>
      </div>
    </div>
  );
}

// ---------- Card ----------

function Card({ appUrl }) {
  return (
    <div
      style={{
        maxWidth: 720,
        margin: "0 auto",
        background: "var(--panel)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "16px 24px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          gap: 14,
          background: "var(--panel-2)",
        }}
      >
        <span
          style={{
            fontFamily: "var(--mono)",
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: "0.04em",
            color: "var(--fg)",
          }}
        >
          promotion-simulation
        </span>
      </div>

      <div
        style={{
          padding: "32px 32px 28px",
          fontFamily: "var(--sans)",
          fontSize: 14,
          lineHeight: 1.65,
          color: "var(--fg-dim)",
        }}
      >
        <p style={{ margin: "0 0 14px" }}>
          A simulator for hands-on practice with configuration management
          across environments.
        </p>
        <p style={{ margin: "0 0 14px" }}>
          When you run several environments — dev, staging, prod,
          sometimes more — keeping their configuration coherent gets
          harder than it looks. Shared values drift apart; values that
          ought to be linked diverge; promoting a change ships either
          too little or too much; an env ends up running something the
          team can't quite reconstruct. Different strategies trade these
          off against each other: shared defaults with per-env overrides,
          build scripts that derive values from each env's identity,
          branch-per-env workflows, deliberate choices about what a
          promotion does and doesn't carry. The scenarios here introduce
          them in order.
        </p>
        <p style={{ margin: "0 0 14px" }}>
          Each one hands you a small repository, a few environments with
          pointers into that repository, and a list of directives
          describing what each environment is supposed to be running. You
          edit, deploy, and promote between environments until the
          directives are satisfied. Pick whichever sounds interesting;
          progress is saved per scenario.
        </p>

        <div
          style={{
            marginTop: 26,
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <a
            href={appUrl}
            style={{
              background: "var(--bg)",
              border: "1px solid var(--accent)",
              borderRadius: 4,
              padding: "8px 16px",
              fontFamily: "var(--mono)",
              fontSize: 12,
              fontWeight: 600,
              color: "var(--fg)",
              textDecoration: "none",
            }}
          >
            launch →
          </a>
        </div>
      </div>
    </div>
  );
}

// ---------- Tweaks ----------

function TweaksUI({ tweaks, setTweak }) {
  const TweaksPanel = window.TweaksPanel;
  const TweakSection = window.TweakSection;
  const TweakRadio = window.TweakRadio;
  const TweakText = window.TweakText;

  if (!TweaksPanel) return null;

  return (
    <TweaksPanel title="Tweaks">
      <TweakSection title="Theme">
        <TweakRadio
          label="Mode"
          value={tweaks.theme}
          onChange={(v) => setTweak("theme", v)}
          options={[
            { value: "dark", label: "Dark" },
            { value: "light", label: "Light" },
          ]}
        />
      </TweakSection>

      <TweakSection title="Links">
        <TweakText
          label="App URL"
          value={tweaks.appUrl}
          onChange={(v) => setTweak("appUrl", v)}
        />
        <TweakText
          label="Repo URL"
          value={tweaks.repoUrl}
          onChange={(v) => setTweak("repoUrl", v)}
        />
      </TweakSection>
    </TweaksPanel>
  );
}

// ---------- Mount ----------

function App() {
  const initial = window.__INITIAL_TWEAKS__;
  const [tweaks, setTweak] = window.useTweaks(initial);

  useEffect(() => {
    document.documentElement.dataset.theme = tweaks.theme;
    try {
      localStorage.setItem("ps-landing-tweaks", JSON.stringify(tweaks));
    } catch (e) {}
  }, [tweaks.theme]);

  return <Page tweaks={tweaks} setTweak={setTweak} />;
}

const root = ReactDOM.createRoot(document.getElementById("page-root"));
root.render(<App />);
