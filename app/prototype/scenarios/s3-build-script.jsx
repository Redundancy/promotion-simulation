/* global window */
// Scenario s3-build-script — "One script, derived config."
//
// First scenario where the participant sees a build script. Single branch,
// three envs all sourcing the same build.js.
//
// FORCING FUNCTION: the seeded build.js only returns { appVersion } — it
// does NOT derive logLevel or replicas. Directives require those fields,
// so the participant has to open build.js, read the (env, api) signature,
// and add the tier-based logic. They learn the script by writing it.
//
// Pedagogical points:
//   - .js source pointers (vs. .json in s1/s2).
//   - The (env, api) signature; reading env identity (env.tier).
//   - Identity-driven derivation: env.tier produces logLevel and replicas.
//   - Determinism: the script is a pure function of (env, files).

(function () {
  const LOG_BY_TIER = { dev: "debug", staging: "info", prod: "warn" };
  const REPLICAS_BY_TIER = { dev: 1, staging: 2, prod: 5 };

  const buildJs =
`${window.BUILD_JS_DOCS}
// ─────────────────────────────────────────────────────────────────────
// TODO for the participant
// ─────────────────────────────────────────────────────────────────────
// Right now this script returns only { appVersion } — every env gets the
// same config. The dev team also needs:
//
//   • logLevel:  "debug" for tier "dev", "info" for "staging", "warn" for "prod"
//   • replicas:  1 for tier "dev",      2 for "staging",      5 for "prod"
//
// Both should DERIVE from env.tier (no per-env files; the env's identity
// tells the script everything it needs). Edit the return value below.
// ─────────────────────────────────────────────────────────────────────
export default async function build(env, api) {
  const v = await api.readJson("config/version.json");
  return {
    appVersion: v.appVersion,
    // logLevel: ???
    // replicas: ???
  };
}
`;

  const initialFiles = {
    "build.js": buildJs,
    "config/version.json": JSON.stringify({ appVersion: "v1.0.0" }, null, 2),
  };

  // Helper that mirrors what the SEEDED (incomplete) build.js currently
  // returns. The expected pane will diff this against the full expected
  // (which includes logLevel and replicas), surfacing the missing keys
  // immediately so the participant sees what they have to add.
  function seedConfigFor(envIdentity, version) {
    return {
      appVersion: version,
    };
  }

  const envs = {
    dev: {
      name: "dev", tier: "dev", region: "us-east-1",
      source: { branch: "main", path: "build.js" },
      version: "v1.0.0", artifactId: "seed-dev",
      lineage: ["dev"], lastDeploy: "seed",
    },
    staging: {
      name: "staging", tier: "staging", region: "us-east-1",
      source: { branch: "main", path: "build.js" },
      version: "v1.0.0", artifactId: "seed-staging",
      lineage: ["staging"], lastDeploy: "seed",
    },
    prod: {
      name: "prod", tier: "prod", region: "us-east-1",
      source: { branch: "main", path: "build.js" },
      version: "v1.0.0", artifactId: "seed-prod",
      lineage: ["prod"], lastDeploy: "seed",
    },
  };
  for (const e of Object.values(envs)) e.config = seedConfigFor(e, e.version);

  const envOrder = ["dev", "staging", "prod"];

  const branches = { main: { ...initialFiles } };

  window.defineScenario({
    id: "s3-build-script",
    title: "one script, derived config",
    summary: "A single build.js on main produces config for every env. The seeded script is incomplete — you finish it so each env gets the right logLevel and replicas for its tier.",
    premise: [
      "You're shipping v1.1.0 to dev → staging → prod. This time the repo holds a build SCRIPT (build.js) instead of config files.",
      "",
      "  • All three envs source the same script: main:build.js.",
      "  • On every deploy the simulator runs the script in a sandboxed Web Worker, passing it the env's identity (env.name, env.tier, env.region) and a read-only file API.",
      "  • Whatever the script returns becomes that env's resolved config.",
      "",
      "The seeded script is incomplete — it only returns { appVersion }. Open build.js: there's a TODO at the top describing what's missing. The dev team needs each env to also get a tier-specific logLevel and replica count, derived from env.tier. You'll finish the script.",
      "",
      "Then edit config/version.json to v1.1.0, and deploy dev → staging → prod in order. The expected pane on each env card shows what the script SHOULD return for that env's tier — match it.",
      "",
      "(Promotion edges exist but have no effects configured — there's only one branch and the version file is shared. To roll forward, just edit and redeploy.)",
    ].join("\n"),
    branches,
    envs,
    envOrder,
    promoteEdges: [
      { id: "dev->staging", from: "dev", to: "staging", effects: [] },
      { id: "staging->prod", from: "staging", to: "prod", effects: [] },
    ],
    topologyNodes: {
      dev:     { x: 200, y: 130 },
      staging: { x: 470, y: 130 },
      prod:    { x: 760, y: 130 },
    },
    configSchema: null,
    expectedConfigFor: (env, version) => ({
      appVersion: version,
      logLevel: LOG_BY_TIER[env.tier] || "info",
      replicas: REPLICAS_BY_TIER[env.tier] || 1,
    }),
    directives: [
      {
        id: "d1", kind: "endpoint",
        label: "dev.config matches expected for its running version",
        check: ({ env, expected, deepEqualSubset }) =>
          deepEqualSubset(env("dev")?.config, expected("dev")),
      },
      {
        id: "d2", kind: "endpoint",
        label: "staging.config matches expected for its running version",
        check: ({ env, expected, deepEqualSubset }) =>
          deepEqualSubset(env("staging")?.config, expected("staging")),
      },
      {
        id: "d3", kind: "endpoint",
        label: "prod.config matches expected for its running version",
        check: ({ env, expected, deepEqualSubset }) =>
          deepEqualSubset(env("prod")?.config, expected("prod")),
      },
      {
        id: "d4", kind: "endpoint",
        label: "all envs are running v1.1.0",
        check: ({ env }) =>
          ["dev", "staging", "prod"].every((n) => env(n)?.version === "v1.1.0"),
      },
      {
        id: "d5", kind: "process",
        label: "envs were deployed in dev → staging → prod order",
        check: ({ env }) => {
          const dts = env("dev")?.lastDeploy;
          const sts = env("staging")?.lastDeploy;
          const pts = env("prod")?.lastDeploy;
          // All three must have been deployed (not "seed") and timestamps
          // must be strictly increasing.
          if (!dts || !sts || !pts) return false;
          if (dts === "seed" || sts === "seed" || pts === "seed") return false;
          return dts < sts && sts < pts;
        },
      },
    ],
  });
})();
