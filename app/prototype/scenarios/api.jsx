/* global window */
// Directive API. A directive's check() receives this frozen API instead of
// raw reducer state, so scenario authors can write predicates against
// envs/sources/files without learning the prototype's internal state shape.
//
// Shape passed to a directive's check() function:
//   {
//     env(name)            => { name, tier, region, datacenter?, ...identityAttrs,
//                               version, artifactId, lineage,
//                               source: { branch, path },
//                               lastDeploy, pendingFrom,
//                               config: Json | null,
//                             } | null
//     expected(envName)    => Json | null — the scenario's expected config for
//                              the env at its currently-deployed version. Pulls
//                              from scenario.expectedConfigFor(env, version) if
//                              defined, else from scenario.expectedConfig[name].
//     deepEqualSubset(a,b) => bool — every key in b deep-equals in a (extras OK)
//     source(envName)      => parsed JSON of the file the env's source points
//                              at. Useful for JSON sources only; .js sources
//                              return null.
//     file(branch, path)   => raw text of the file, or null
//     branches()           => string[]
//     trace                => readonly trace event array

function makeDirectiveAPI(state) {
  const repo = state.repo;
  const envs = state.envs;
  const scenario = state.scenarioId ? window.getScenario(state.scenarioId) : null;

  const env = (name) => {
    const e = envs[name];
    if (!e) return null;
    const out = {
      version: e.version,
      artifactId: e.artifactId,
      lineage: Object.freeze([...(e.lineage || [])]),
      source: Object.freeze({ branch: e.source.branch, path: e.source.path }),
      lastDeploy: e.lastDeploy,
      pendingFrom: e.pendingFrom ? Object.freeze({ ...e.pendingFrom }) : null,
      config: e.config !== null && e.config !== undefined
        ? JSON.parse(JSON.stringify(e.config))
        : null,
    };
    for (const [k, v] of Object.entries(e)) {
      if (!window.ENV_RUNTIME_FIELDS.has(k)) out[k] = v;
    }
    return Object.freeze(out);
  };

  const file = (branch, path) => {
    const b = repo.branches[branch];
    if (!b) return null;
    const text = b[path];
    return text === undefined ? null : text;
  };

  const source = (envName) => {
    const e = envs[envName];
    if (!e) return null;
    const text = file(e.source.branch, e.source.path);
    if (text === null) return null;
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  };

  const expected = (envName) => {
    const e = envs[envName];
    if (!e || !scenario) return null;
    const r = window.materializeExpected(scenario, window.envIdentityOf(e), e.version);
    return r === null || r === undefined ? null : JSON.parse(JSON.stringify(r));
  };

  const branches = () => Object.keys(repo.branches);

  return Object.freeze({
    env,
    expected,
    deepEqualSubset: window.deepEqualSubset,
    source,
    file,
    branches,
    trace: Object.freeze(state.trace),
  });
}

Object.assign(window, { makeDirectiveAPI });
