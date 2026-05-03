/* global React, ReactDOM, window */
// Root app component — handles scene routing.

function App() {
  const [state, dispatch, getState] = window.useStore();

  // Dev escape hatches.
  React.useEffect(() => {
    window.__reset = () => dispatch({ type: "RESET" });
    window.__exit = () => dispatch({ type: "EXIT_TO_INTRO" });
  }, [dispatch]);

  if (!state.scenarioId) return <window.IntroScene dispatch={dispatch} />;
  if (state.scene === "intro")    return <window.IntroScene dispatch={dispatch} />;
  if (state.scene === "debrief")  return <window.DebriefScene state={state} dispatch={dispatch} />;
  return <window.WorkspaceScene state={state} dispatch={dispatch} getState={getState} />;
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
