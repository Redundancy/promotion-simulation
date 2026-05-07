/* global window */
// Scenario s6-branching — "Branch per env: refactor in isolation."
//
// First scenario where the participant uses branches. Each env has its OWN
// branch holding a copy of build.js + config/version.json. The dev team is
// asking for a refactor (add a new derived field, bump version) and the
// participant does the work on dev's branch. While iterating on dev,
// staging and prod stay running their stable v1.0.0 build.js — their
// directives stay green throughout — because their script is on a
// different branch.
//
// FORCING FUNCTION (concept): refactor isolation. The seeded build.js
// derives appVersion + logLevel + replicas; the participant must add a
// new derived field, cacheKey, AND bump appVersion to v1.1.0. The
// directives reward iterating on dev first (d1 flips red as soon as you
// commit dev to v1.1.0 without cacheKey; d2/d3 stay green because
// staging/prod's branch is unchanged at v1.0.0). Only after promote do
// staging/prod move to v1.1.0 and require the new field.
//
// FORCING FUNCTION (mechanism): the lineage directive (d5) requires
// prod's artifact to have flowed dev → staging → prod. Hand-editing each
// branch satisfies d1–d4 but not d5 — so the participant must use
// promote (and therefore copy-branch).

(function () {
  // The build script lives on every branch (initially identical). It
  // already does the s3 trick of deriving logLevel + replicas from tier;
  // the refactor adds cacheKey and bumps version. The TODO comment
  // describes what's needed.
  const buildJs =
`${window.BUILD_JS_DOCS}
// ─────────────────────────────────────────────────────────────────────
// Refactor in flight
// ─────────────────────────────────────────────────────────────────────
// This script lives on every branch (a copy on dev, staging, and prod).
// The dev team is asking for two changes:
//
//   1. Bump appVersion to v1.1.0 (edit config/version.json).
//   2. Add a new derived field: cacheKey = \`\${env.name}-\${appVersion}\`.
//      Example: dev at v1.1.0 → cacheKey "dev-v1.1.0".
//
// Plan: do the work on the dev branch FIRST. While you iterate on dev,
// staging and prod keep running their existing v1.0.0 build.js — their
// directives stay satisfied — because each branch holds its own copy of
// this script. When you're happy with dev, promote dev → staging → prod
// (the configured copy-branch effect ships both files forward).
// ─────────────────────────────────────────────────────────────────────
export default async function build(env, api) {
  const v = await api.readJson("config/version.json");
  return {
    appVersion: v.appVersion,
    logLevel:
      env.tier === "prod"    ? "warn"
    : env.tier === "staging" ? "info"
    :                          "debug",
    replicas:
      env.tier === "prod"    ? 5
    : env.tier === "staging" ? 2
    :                          1,
    // cacheKey: ???
  };
}
`;

  const versionFile = JSON.stringify({ appVersion: "v1.0.0" }, null, 2);
  const branchFiles = {
    "build.js": buildJs,
    "config/version.json": versionFile,
  };

  const branches = {
    dev:     { ...branchFiles },
    staging: { ...branchFiles },
    prod:    { ...branchFiles },
  };

  const LOG_BY_TIER = { dev: "debug", staging: "info", prod: "warn" };
  const REPLICAS_BY_TIER = { dev: 1, staging: 2, prod: 5 };

  // Mirrors the SEEDED build.js for the v1.0.0 state — no cacheKey, since
  // the participant hasn't added it yet. Once an env is at v1.1.0,
  // expectedConfigFor will demand cacheKey, and the deployed config has
  // to provide it.
  function seedConfigFor(envIdentity, version) {
    return {
      appVersion: version,
      logLevel: LOG_BY_TIER[envIdentity.tier] || "info",
      replicas: REPLICAS_BY_TIER[envIdentity.tier] || 1,
    };
  }

  const envs = {
    dev: {
      name: "dev", tier: "dev", region: "us-east-1",
      source: { branch: "dev", path: "build.js" },
      version: "v1.0.0", artifactId: "seed-dev",
      lineage: ["dev"], lastDeploy: "seed",
    },
    staging: {
      name: "staging", tier: "staging", region: "us-east-1",
      source: { branch: "staging", path: "build.js" },
      version: "v1.0.0", artifactId: "seed-staging",
      lineage: ["staging"], lastDeploy: "seed",
    },
    prod: {
      name: "prod", tier: "prod", region: "us-east-1",
      source: { branch: "prod", path: "build.js" },
      version: "v1.0.0", artifactId: "seed-prod",
      lineage: ["prod"], lastDeploy: "seed",
    },
  };
  for (const e of Object.values(envs)) e.config = seedConfigFor(e, e.version);

  const envOrder = ["dev", "staging", "prod"];

  window.defineScenario({
    id: "s6-branching",
    title: "branch per env: refactor in isolation",
    summary: "Each env has its own branch holding its own build.js. Refactor the script on dev — add a new derived field and bump version — while staging and prod keep running their stable v1.0.0. Then promote forward.",
    premise: [
      "Your platform now uses BRANCH PER ENV. Each env's source is build.js on its own branch:",
      "",
      "  • dev → dev:build.js",
      "  • staging → staging:build.js",
      "  • prod → prod:build.js",
      "",
      "All three branches start with the SAME build.js (it derives logLevel + replicas from env.tier — the same trick as the previous scenario).",
      "",
      "The dev team has two asks:",
      "",
      "  1. Add a derived field: cacheKey = `${env.name}-${appVersion}`.",
      "     E.g. dev at v1.1.0 should produce cacheKey \"dev-v1.1.0\".",
      "  2. Bump appVersion to v1.1.0.",
      "",
      "Why branches matter here: doing this refactor on dev's branch only means staging and prod KEEP RUNNING THEIR V1.0.0 SCRIPT during your iteration. Their directives stay satisfied. If everything were on one branch, every save you made to build.js would risk breaking them on the next deploy.",
      "",
      "Plan: open dev's build.js (switch the FileTree to dev), add the cacheKey logic, bump dev's config/version.json to v1.1.0, deploy dev. Once dev's directive is green, promote dev → staging (the configured copy-branch effect ships both files), deploy staging, then promote and deploy prod.",
    ].join("\n"),
    branches,
    envs,
    envOrder,
    promoteEdges: [
      {
        id: "dev->staging", from: "dev", to: "staging",
        effects: [{ kind: "copy-branch", from: "dev", to: "staging" }],
      },
      {
        id: "staging->prod", from: "staging", to: "prod",
        effects: [{ kind: "copy-branch", from: "staging", to: "prod" }],
      },
    ],
    topologyNodes: {
      dev:     { x: 200, y: 130 },
      staging: { x: 470, y: 130 },
      prod:    { x: 760, y: 130 },
    },
    configSchema: null,
    // cacheKey is only "expected" once the env is at v1.1.0 — that way
    // staging and prod stay green at v1.0.0 (their initial state) WHILE
    // the participant iterates on dev. After promote+deploy at v1.1.0
    // they need to produce cacheKey too. This is the whole point of the
    // scenario — feel the isolation.
    expectedConfigFor: (env, version) => {
      const base = {
        appVersion: version,
        logLevel: LOG_BY_TIER[env.tier] || "info",
        replicas: REPLICAS_BY_TIER[env.tier] || 1,
      };
      if (version === "v1.1.0") {
        base.cacheKey = `${env.name}-${version}`;
      }
      return base;
    },
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
        label: "prod's artifact came through staging, which came through dev",
        check: ({ env }) => {
          const lin = env("prod")?.lineage || [];
          const di = lin.indexOf("dev");
          const si = lin.indexOf("staging");
          const pi = lin.lastIndexOf("prod");
          return di >= 0 && si > di && pi > si;
        },
      },
    ],
  });
})();
