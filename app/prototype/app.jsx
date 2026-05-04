/* global React, ReactDOM, window */
// Root app component — handles scene routing.

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    // Log the underlying error (with stack) so we don't only see React's
    // "above error occurred" wrapper.
    console.error("ErrorBoundary caught:", error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 32, fontFamily: "var(--mono, monospace)", color: "#e57373" }}>
          <h2 style={{ marginTop: 0 }}>The workspace crashed.</h2>
          <p style={{ color: "#d6dae3" }}>{String(this.state.error?.message || this.state.error)}</p>
          <pre style={{ background: "#1e2230", padding: 12, borderRadius: 4, overflow: "auto", fontSize: 11 }}>
            {String(this.state.error?.stack || "(no stack)")}
          </pre>
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button onClick={() => { window.__exit(); this.setState({ error: null }); }}
                    style={{ padding: "6px 12px" }}>back to chooser</button>
            <button onClick={() => { localStorage.clear(); location.reload(); }}
                    style={{ padding: "6px 12px" }}>reset everything</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  const [state, dispatch, getState] = window.useStore();

  React.useEffect(() => {
    window.__reset = () => dispatch({ type: "RESET" });
    window.__exit = () => dispatch({ type: "EXIT_TO_INTRO" });
  }, [dispatch]);

  let scene;
  if (!state.scenarioId)               scene = <window.IntroScene dispatch={dispatch} />;
  else if (state.scene === "intro")    scene = <window.IntroScene dispatch={dispatch} />;
  else if (state.scene === "debrief")  scene = <window.DebriefScene state={state} dispatch={dispatch} />;
  else                                 scene = <window.WorkspaceScene state={state} dispatch={dispatch} getState={getState} />;

  return (
    <ErrorBoundary>
      {scene}
      {state.guideOpen && <window.GuideModal dispatch={dispatch} />}
    </ErrorBoundary>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
