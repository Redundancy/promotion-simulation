/* global window */
// Directive API. A directive's check() receives this frozen API instead of
// raw reducer state, so scenario authors can write predicates against
// envs/sources/files without learning the prototype's internal state shape.
//
// Shape passed to a directive's check() function:
//   {
//     env(name)        => { name, tier, region, datacenter?, ...identityAttrs,
//                           version, artifactId, lineage,
//                           source: { branch, path },
//                           lastDeploy, pendingFrom,
//                           config: Json | null,    // last-deployed resolved config
//                         } | null
//     source(envName)  => parsed JSON of the file the env's source points at,
//                         or null on parse error / missing file. Useful for
//                         JSON sources only; .js sources return null.
//     file(branch, path) => raw text of the file, or null
//     branches()       => string[]   // available branch names
//     trace            => readonly trace event array
//
// Note: env(name).config is the resolved config from the most recent deploy.
// For JS sources, this is what the script returned. For JSON sources, this is
// the parsed source as of the deploy. It is null until the first deploy.

function makeDirectiveAPI(state) {
  const repo = state.repo;
  const envs = state.envs;

  // Identity attributes vs runtime fields — runtime fields are always
  // exposed by name, identity attributes are passed through whatever the
  // scenario put on the env object.
  const RUNTIME_FIELDS = new Set([
    "source", "version", "artifactId", "lineage",
    "lastDeploy", "deployedSource", "pendingFrom", "config",
  ]);

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
      // Deep-freeze the config so directives can't mutate it.
      config: e.config !== null && e.config !== undefined
        ? JSON.parse(JSON.stringify(e.config))
        : null,
    };
    // Identity attributes (name, tier, region, datacenter, ...) come from
    // whatever the scenario put on the env object. Pass through everything
    // not in RUNTIME_FIELDS.
    for (const [k, v] of Object.entries(e)) {
      if (!RUNTIME_FIELDS.has(k)) out[k] = v;
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

  const branches = () => Object.keys(repo.branches);

  return Object.freeze({
    env,
    source,
    file,
    branches,
    trace: Object.freeze(state.trace),
  });
}

Object.assign(window, { makeDirectiveAPI });
