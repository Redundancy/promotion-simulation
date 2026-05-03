/* global React, ReactDOM */
const { useEffect } = React;

// ---------- Content ----------

const SCENARIOS = [
  {
    n: "01",
    title: "Inheriting a platform",
    blurb:
      "You arrive on day one. There's an environment, a config file, and a list of things the dev team needs reflected in it. Get the loop turning.",
    surfaces: ["intro", "repo", "deploy"],
    status: "ready",
  },
  {
    n: "02",
    title: "A second environment",
    blurb:
      "Staging now exists. It needs its own configuration. How you set that up is up to you — and you'll live with it for a while.",
    surfaces: ["environments"],
    status: "draft",
  },
  {
    n: "03",
    title: "Something shared",
    blurb:
      "A new requirement arrives that touches more than one environment. Whatever you set up last time has an opinion about how easy this is.",
    surfaces: ["scoping"],
    status: "draft",
  },
  {
    n: "04",
    title: "A new version",
    blurb:
      "The application has changed. It expects things from its config it didn't expect last week. Your move.",
    surfaces: ["promotion", "versions"],
    status: "draft",
  },
  {
    n: "05",
    title: "Off the rails",
    blurb:
      "Something landed in production that didn't come through the front door. The clock is running on the next normal release.",
    surfaces: ["hotfix", "divergence"],
    status: "draft",
  },
];

// ---------- Page ----------

function Page({ tweaks, setTweak }) {
  return (
    <>
      <Topbar appUrl={tweaks.appUrl} repoUrl={tweaks.repoUrl} />
      <Hero tweaks={tweaks} />
      <Premise />
      <Norm />
      <Mechanics />
      <Scenarios showStatus={tweaks.showStatusColumn} />
      <Footer repoUrl={tweaks.repoUrl} />
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
          <a href="#premise">Premise</a>
          <a href="#norm">The norm</a>
          <a href="#mechanics">Mechanics</a>
          <a href="#scenarios">Scenarios</a>
          <a href={repoUrl} target="_blank" rel="noreferrer">Repo&nbsp;↗</a>
          <a href={appUrl} className="primary-link" style={{ color: "var(--accent)" }}>
            Launch&nbsp;→
          </a>
        </nav>
      </div>
    </div>
  );
}

// ---------- Hero ----------

function Hero({ tweaks }) {
  return (
    <header className="hero">
      <div className="container">
        <div className="eyebrow">For platform engineers</div>
        <h1>
          A sandbox for the <em>structural</em> decisions you usually only
          get to make once.
        </h1>
        <p className="hero-sub">
          Edit a repo. Deploy. Promote. See how you react to various
          hypothetical situations a platform engineer might encounter.
        </p>
        <div className="hero-actions">
          <a className="btn primary" href={tweaks.appUrl}>
            Launch simulation <span className="arrow">→</span>
          </a>
          <a className="btn" href="#scenarios">
            See scenarios
          </a>
          <a className="btn" href={tweaks.repoUrl} target="_blank" rel="noreferrer">
            Source ↗
          </a>
        </div>

        {tweaks.showHeroMeta && (
          <div className="hero-meta">
            <div>
              <div className="k">Role</div>
              <div className="v">Platform engineer</div>
            </div>
            <div>
              <div className="k">Surface</div>
              <div className="v">Repo · artifact store · envs</div>
            </div>
            <div>
              <div className="k">Runtime</div>
              <div className="v">In-browser, sandboxed JS</div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

// ---------- Premise ----------

function Premise() {
  return (
    <section className="block" id="premise">
      <div className="container">
        <div className="section-head">
          <div className="label">§ 01 — Premise</div>
          <h2>You inherit a platform. Then it grows.</h2>
          <p className="lede">
            Each scenario hands you a small situation and a few requirements.
            Solve them however you like. You don't control the application
            — only the platform around it. The platform you build along
            the way is what you bring with you to the next scenario.
          </p>
        </div>

        <div className="body-grid">
          <div className="meta">// shape</div>
          <div className="content">
            <p>
              No score, no leaderboard, no "correct" answer screen. There
              are usually several reasonable ways through any given
              situation.
            </p>
            <p>
              The simulation tells you when the requirements are met. You
              get to decide how well your approach is working, and whether
              it should change as you encounter different situations —
              which may, or may not, challenge it.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------- The norm ----------

function Norm() {
  return (
    <section className="block" id="norm">
      <div className="container">
        <div className="section-head">
          <div className="label">§ 02 — House rule</div>
          <h2>One thing the simulation has an opinion about. Everything else is up to you.</h2>
        </div>

        <div className="body-grid">
          <div className="meta">// the rule</div>
          <div className="content">
            <blockquote
              style={{
                margin: 0,
                padding: "20px 24px",
                borderLeft: "3px solid var(--accent)",
                background: "var(--panel)",
                fontFamily: "var(--mono)",
                fontSize: 15,
                color: "var(--fg)",
                lineHeight: 1.6,
              }}
            >
              Promoting between environments doesn't get to edit
              configuration on the way.
            </blockquote>
            <p style={{ marginTop: 20 }}>
              You can change config any time you want. You just have to do
              it as its own action, against a specific environment. Promote
              moves the application; it doesn't fix things up for you.
            </p>
            <p>
              That's the only rail. Everything else — how the repo is
              organized, what each environment points at, what runs
              alongside a promote — is yours to design.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------- Mechanics ----------

function Mechanics() {
  const items = [
    {
      k: "Repo",
      v: "Files you author. Configuration as JSON, or scripts that produce JSON. Layout, naming, how it's organized — yours.",
    },
    {
      k: "Artifact store",
      v: "A shared space where application builds and external modules show up. You can read from it; you can put things into it as part of how a promotion works.",
    },
    {
      k: "Environments",
      v: "Each one has whatever application version and configuration it currently has, plus a history of how it got there. Visible the whole time.",
    },
    {
      k: "Deploy",
      v: "Pushes a fresh configuration into one environment. This is how config changes reach a place.",
    },
    {
      k: "Promote",
      v: "Moves an application version from one environment to another. Anything you've wired up to ride along, rides along.",
    },
  ];

  return (
    <section className="block" id="mechanics">
      <div className="container">
        <div className="section-head">
          <div className="label">§ 03 — Surface</div>
          <h2>Three places to look. Two buttons to press.</h2>
          <p className="lede">
            That's the whole interface. The interesting decisions live in
            what you put into the repo and how you wire it up.
          </p>
        </div>

        <div className="body-grid">
          <div className="meta">// surface</div>
          <div className="content" style={{ maxWidth: "100%" }}>
            <dl style={{ margin: 0, display: "flex", flexDirection: "column", gap: 0 }}>
              {items.map((it, i) => (
                <div
                  key={it.k}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "180px 1fr",
                    gap: 32,
                    padding: "20px 0",
                    borderTop: i === 0 ? "1px solid var(--border)" : "none",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  <dt
                    style={{
                      fontFamily: "var(--mono)",
                      fontSize: 13,
                      color: "var(--fg)",
                      letterSpacing: "0.02em",
                    }}
                  >
                    {it.k}
                  </dt>
                  <dd style={{ margin: 0, color: "var(--fg-dim)", maxWidth: "60ch", textWrap: "pretty" }}>
                    {it.v}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------- Scenarios ----------

function Scenarios({ showStatus }) {
  return (
    <section className="block" id="scenarios">
      <div className="container">
        <div className="section-head">
          <div className="label">§ 04 — Progression</div>
          <h2>Five scenarios. Each one is a small situation.</h2>
          <p className="lede">
            They're meant to be played in order. What you build in one
            sticks around for the next. None of them comes with
            instructions.
          </p>
        </div>

        <div className="body-grid">
          <div className="meta">// progression</div>
          <div className="scenario-list">
            {SCENARIOS.map((s) => (
              <article className="scenario" key={s.n}>
                <div className="num">{s.n}</div>
                <div>
                  <h3>{s.title}</h3>
                  <p>{s.blurb}</p>
                </div>
                <div className="surfaces">
                  {s.surfaces.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
                {showStatus ? (
                  <div className={`status ${s.status}`}>
                    <span className="dot" />
                    {s.status === "ready" ? "Ready" : "Drafted"}
                  </div>
                ) : (
                  <div />
                )}
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------- What it never does ----------

function NeverDoes() {
  const items = [
    "Tell you which structure is right.",
    "Score or grade your solution.",
    "Pop up hints unprompted.",
    "Penalize duplication.",
    "Block button presses you might regret.",
    "Decide for you when to promote.",
    "Call solutions naive, wrong, or suboptimal.",
    "Nudge toward specific patterns during scenarios.",
    "Pop up hints unprompted.",
    "Interpret the participant's choices.",
  ];

  return (
    <section className="block" id="never">
      <div className="container">
        <div className="section-head">
          <div className="label">§ 05 — What it doesn't do</div>
          <h2>A short list, mostly to set expectations.</h2>
        </div>

        <div className="body-grid">
          <div className="meta">// excluded</div>
          <div className="content" style={{ maxWidth: "100%" }}>
            <ul style={{ margin: 0, padding: 0, listStyle: "none", borderTop: "1px solid var(--border)" }}>
              {items.map((it, i) => (
                <li
                  key={i}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "48px 1fr",
                    gap: 16,
                    padding: "14px 0",
                    borderBottom: "1px solid var(--border)",
                    color: "var(--fg-dim)",
                    fontSize: 15,
                    textWrap: "pretty",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--mono)",
                      fontSize: 11,
                      color: "var(--fg-faint)",
                      letterSpacing: "0.06em",
                      paddingTop: 3,
                    }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span>{it}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------- Footer ----------

function Footer({ repoUrl }) {
  return (
    <footer>
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand">
            <strong>promotion-simulation</strong>
            <br />
            A browser-based sandbox for platform engineering practice. Open
            source. Runs entirely in your browser — nothing leaves the tab.
          </div>
          <div className="footer-links">
            <a href={repoUrl} target="_blank" rel="noreferrer">github ↗</a>
            <a href="./app/">launch app →</a>
            <a href="#premise">back to top ↑</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

// ---------- Tweaks ----------

function TweaksUI({ tweaks, setTweak }) {
  const TweaksPanel = window.TweaksPanel;
  const TweakSection = window.TweakSection;
  const TweakRadio = window.TweakRadio;
  const TweakToggle = window.TweakToggle;
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

      <TweakSection title="Layout">
        <TweakRadio
          label="Density"
          value={tweaks.density}
          onChange={(v) => setTweak("density", v)}
          options={[
            { value: "compact", label: "Compact" },
            { value: "default", label: "Default" },
            { value: "roomy", label: "Roomy" },
          ]}
        />
        <TweakRadio
          label="Width"
          value={tweaks.layout}
          onChange={(v) => setTweak("layout", v)}
          options={[
            { value: "narrow", label: "Narrow" },
            { value: "default", label: "Default" },
            { value: "wide", label: "Wide" },
          ]}
        />
      </TweakSection>

      <TweakSection title="Sections">
        <TweakToggle
          label="Hero meta strip"
          value={tweaks.showHeroMeta}
          onChange={(v) => setTweak("showHeroMeta", v)}
        />
        <TweakToggle
          label="Scenario status column"
          value={tweaks.showStatusColumn}
          onChange={(v) => setTweak("showStatusColumn", v)}
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
  // useTweaks: host-aware tweak hook — returns [state, setKey].
  // setKey accepts (key, value) or {key: value, ...}.
  const [tweaks, setTweak] = window.useTweaks(initial);

  // Apply theme/density/layout to <html> on every change + persist locally.
  useEffect(() => {
    document.documentElement.dataset.theme = tweaks.theme;
    document.documentElement.dataset.density = tweaks.density;
    document.documentElement.dataset.layout = tweaks.layout;
    try {
      localStorage.setItem("ps-landing-tweaks", JSON.stringify(tweaks));
    } catch (e) {}
  }, [tweaks.theme, tweaks.density, tweaks.layout]);

  return <Page tweaks={tweaks} setTweak={setTweak} />;
}

const root = ReactDOM.createRoot(document.getElementById("page-root"));
root.render(<App />);
