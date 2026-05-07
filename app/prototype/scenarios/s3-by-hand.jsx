/* global window */
// Scenario s3-by-hand — "Five envs, every value typed twice."
//
// Five environments (dev, staging, three regional prods) each with their
// own JSON config file holding six values. Every value is hand-written;
// nothing enforces that values which logically depend on each other (e.g.
// cacheKey "should follow" `${serviceName}-${appVersion}`) actually do.
//
// FORCING FUNCTION (concept): scale. Bumping appVersion to v1.1.0 means
// updating BOTH appVersion AND cacheKey in five files — ten careful
// edits, any of which can be mistyped and quietly leave an env wrong.
// And cacheKey is "supposed to" track appVersion, but only the
// participant's discipline keeps the link; nothing in the simulator
// enforces it.
//
// Pedagogical points:
//   - Per-env JSON files don't scale: more envs = more places to drift.
//   - Hostname is composable from serviceName + env.name + env.region;
//     cacheKey is composable from serviceName + appVersion. Both are
//     hand-typed here, which lets them drift independent of inputs.
//   - The next scenario (s4-build-script) addresses this directly:
//     a script computes derivable values at deploy time, so the link
//     between cacheKey and appVersion (and hostname and its inputs)
//     becomes structural rather than dependent on careful editing.

(function () {
  const SERVICE = "checkout-api";
  const REPLICAS_BY_TIER = { dev: 1, staging: 2, prod: 5 };
  const LOG_BY_TIER     = { dev: "debug", staging: "info", prod: "warn" };

  function hostnameFor(envName, region) {
    return `${SERVICE}.${envName}.${region}.acme.example`;
  }
  function cacheKeyFor(version) {
    return `${SERVICE}-${version}`;
  }

  // The initial files. Every value is hand-written; the patterns
  // (hostname, cacheKey) are the participant's responsibility to
  // maintain.
  function fileFor(envName, region, tier, version) {
    return JSON.stringify({
      appVersion: version,
      serviceName: SERVICE,
      replicas: REPLICAS_BY_TIER[tier] || 1,
      logLevel: LOG_BY_TIER[tier] || "info",
      hostname: hostnameFor(envName, region),
      cacheKey: cacheKeyFor(version),
    }, null, 2);
  }

  const initialFiles = {
    "config/dev.json":       fileFor("dev",       "us-east-1", "dev",     "v1.0.0"),
    "config/staging.json":   fileFor("staging",   "us-east-1", "staging", "v1.0.0"),
    "config/prod-east.json": fileFor("prod-east", "us-east-1", "prod",    "v1.0.0"),
    "config/prod-west.json": fileFor("prod-west", "us-west-2", "prod",    "v1.0.0"),
    "config/prod-eu.json":   fileFor("prod-eu",   "eu-west-1", "prod",    "v1.0.0"),
  };

  function seedConfigFor(envIdentity, version) {
    return {
      appVersion: version,
      serviceName: SERVICE,
      replicas: REPLICAS_BY_TIER[envIdentity.tier] || 1,
      logLevel: LOG_BY_TIER[envIdentity.tier] || "info",
      hostname: hostnameFor(envIdentity.name, envIdentity.region),
      cacheKey: cacheKeyFor(version),
    };
  }

  const envs = {
    dev: {
      name: "dev", tier: "dev", region: "us-east-1",
      source: { branch: "main", path: "config/dev.json" },
      version: "v1.0.0", artifactId: "seed-dev",
      lineage: ["dev"], lastDeploy: "seed",
    },
    staging: {
      name: "staging", tier: "staging", region: "us-east-1",
      source: { branch: "main", path: "config/staging.json" },
      version: "v1.0.0", artifactId: "seed-staging",
      lineage: ["staging"], lastDeploy: "seed",
    },
    "prod-east": {
      name: "prod-east", tier: "prod", region: "us-east-1",
      source: { branch: "main", path: "config/prod-east.json" },
      version: "v1.0.0", artifactId: "seed-prod-east",
      lineage: ["prod-east"], lastDeploy: "seed",
    },
    "prod-west": {
      name: "prod-west", tier: "prod", region: "us-west-2",
      source: { branch: "main", path: "config/prod-west.json" },
      version: "v1.0.0", artifactId: "seed-prod-west",
      lineage: ["prod-west"], lastDeploy: "seed",
    },
    "prod-eu": {
      name: "prod-eu", tier: "prod", region: "eu-west-1",
      source: { branch: "main", path: "config/prod-eu.json" },
      version: "v1.0.0", artifactId: "seed-prod-eu",
      lineage: ["prod-eu"], lastDeploy: "seed",
    },
  };
  for (const e of Object.values(envs)) e.config = seedConfigFor(e, e.version);

  const envOrder = ["dev", "staging", "prod-east", "prod-west", "prod-eu"];

  const branches = { main: { ...initialFiles } };

  window.defineScenario({
    id: "s3-by-hand",
    title: "five envs, every value typed twice",
    summary: "Five environments, each with its own per-env JSON file holding six values. Bump appVersion to v1.1.0 across the fleet — and update cacheKey to match in every file.",
    premise: [
      "You inherited a five-environment platform. Each env has its own JSON config file:",
      "",
      "  • config/dev.json        (dev,        us-east-1)",
      "  • config/staging.json    (staging,    us-east-1)",
      "  • config/prod-east.json  (prod-east,  us-east-1)",
      "  • config/prod-west.json  (prod-west,  us-west-2)",
      "  • config/prod-eu.json    (prod-eu,    eu-west-1)",
      "",
      "Each file holds six keys:",
      "",
      "  appVersion    serviceName    replicas    logLevel    hostname    cacheKey",
      "",
      "All values are HAND-WRITTEN. Some happen to follow patterns:",
      "",
      "  hostname  =  ${serviceName}.${env.name}.${env.region}.acme.example",
      "  cacheKey  =  ${serviceName}-${appVersion}",
      "",
      "…but those patterns are the previous platform engineer's discipline, not anything the simulator enforces. Type one wrong and that env quietly runs the wrong config.",
      "",
      "The dev team wants v1.1.0 deployed everywhere. That means TWO updates per file: bump appVersion to v1.1.0, AND update cacheKey to checkout-api-v1.1.0. Five files × two edits = ten careful changes. Miss one, some env fails its directive.",
      "",
      "Promote edges are configured but with no effects — there's no clean way to copy a file forward when each env's hostname embeds its own name and region. Promote here just records the lineage; the file edits are yours.",
    ].join("\n"),
    branches,
    envs,
    envOrder,
    promoteEdges: [
      { id: "dev->staging",      from: "dev",     to: "staging",   effects: [] },
      { id: "staging->prod-east", from: "staging", to: "prod-east", effects: [] },
      { id: "staging->prod-west", from: "staging", to: "prod-west", effects: [] },
      { id: "staging->prod-eu",   from: "staging", to: "prod-eu",   effects: [] },
    ],
    topologyNodes: {
      dev:         { x:  90, y: 200 },
      staging:     { x: 330, y: 200 },
      "prod-east": { x: 590, y:  90 },
      "prod-west": { x: 590, y: 200 },
      "prod-eu":   { x: 590, y: 310 },
    },
    configSchema: null,
    expectedConfigFor: (env, version) => ({
      appVersion: version,
      serviceName: SERVICE,
      replicas: REPLICAS_BY_TIER[env.tier] || 1,
      logLevel: LOG_BY_TIER[env.tier] || "info",
      hostname: hostnameFor(env.name, env.region),
      cacheKey: cacheKeyFor(version),
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
        label: "prod-east.config matches expected",
        check: ({ env, expected, deepEqualSubset }) =>
          deepEqualSubset(env("prod-east")?.config, expected("prod-east")),
      },
      {
        id: "d4", kind: "endpoint",
        label: "prod-west.config matches expected",
        check: ({ env, expected, deepEqualSubset }) =>
          deepEqualSubset(env("prod-west")?.config, expected("prod-west")),
      },
      {
        id: "d5", kind: "endpoint",
        label: "prod-eu.config matches expected",
        check: ({ env, expected, deepEqualSubset }) =>
          deepEqualSubset(env("prod-eu")?.config, expected("prod-eu")),
      },
      {
        id: "d6", kind: "endpoint",
        label: "all envs are running v1.1.0",
        check: ({ env }) =>
          ["dev", "staging", "prod-east", "prod-west", "prod-eu"]
            .every((n) => env(n)?.version === "v1.1.0"),
      },
      {
        id: "d7", kind: "process",
        label: "every prod env's artifact came through staging",
        check: ({ env }) => {
          for (const n of ["prod-east", "prod-west", "prod-eu"]) {
            const lin = env(n)?.lineage || [];
            const si = lin.indexOf("staging");
            const last = lin.lastIndexOf(n);
            if (si < 0 || si >= last) return false;
          }
          return true;
        },
      },
    ],
  });
})();
