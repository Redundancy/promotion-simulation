/* global window */
// Scenario s3-branch-per-env — "Branch per env, layered build."
//
// Three envs (dev, staging, prod) each pointing at build.js on its own
// branch (one branch per env). build.js is a script that merges layered
// configuration from files in the same branch:
//   defaults.json → region/<region>.json → dc/<datacenter>.json → env/<name>.json
//
// Promotion ships ALL files from the source branch onto the target branch
// via the `copy-branch` effect (declared on each promote edge). After a
// copy-branch and a deploy, the target env runs the same script with its
// own identity, picking up its own region/dc/env overlays.
//
// Pedagogical points this scenario demonstrates:
//   - Branch-per-env strategy (each env's source on its own branch).
//   - Layered configuration merging (defaults → region → dc → env).
//   - Multiple identity attributes (region AND datacenter) each driving a
//     layer.
//   - Promotion via branch copy: ship the whole branch, not a single file.
//   - Same script in different branches: the participant's job is to
//     evolve the script (and/or its data) on dev, then ship via promotes.

(function () {
  const buildJs =
`// build.js — runs on every deploy.
// Each env's source points at THIS file on its own branch. This script reads
// layered config files from the same branch and merges them, most-specific
// wins (env > dc > region > defaults). It also tags the result with env
// identity so the resolved config records who it ran for.
export default async function build(env, api) {
  const defaults = await api.readJson("layers/defaults.json");
  const region   = await api.readJson(\`layers/region/\${env.region}.json\`);
  const dc       = await api.readJson(\`layers/dc/\${env.datacenter}.json\`);
  const overlay  = await api.readJson(\`layers/env/\${env.name}.json\`);
  return {
    ...defaults,
    ...region,
    ...dc,
    ...overlay,
    env: env.name,
    tier: env.tier,
  };
}
`;

  // Every branch starts with the SAME contents. Diffs only appear when the
  // participant edits a file on one branch.
  const layeredFiles = {
    "build.js": buildJs,
    "layers/defaults.json": JSON.stringify({
      appVersion: "v1.0.0",
      logLevel: "info",
      featureFlags: [],
    }, null, 2),
    "layers/region/us-east-1.json": JSON.stringify({
      regionLabel: "us-east-1",
      failoverRegion: "us-west-2",
    }, null, 2),
    "layers/region/us-west-2.json": JSON.stringify({
      regionLabel: "us-west-2",
      failoverRegion: "us-east-1",
    }, null, 2),
    "layers/dc/iad-1.json": JSON.stringify({ zone: "iad-1" }, null, 2),
    "layers/dc/iad-2.json": JSON.stringify({ zone: "iad-2" }, null, 2),
    "layers/dc/pdx-1.json": JSON.stringify({ zone: "pdx-1" }, null, 2),
    "layers/env/dev.json":     JSON.stringify({ logLevel: "debug" }, null, 2),
    "layers/env/staging.json": JSON.stringify({}, null, 2),
    "layers/env/prod.json":    JSON.stringify({ logLevel: "warn" }, null, 2),
  };

  const envs = {
    dev: {
      name: "dev", tier: "dev",
      region: "us-east-1", datacenter: "iad-1",
      source: { branch: "dev", path: "build.js" },
      version: "v1.0.0", artifactId: "seed-dev",
      lineage: ["dev"], lastDeploy: "seed",
      // Pre-seed config so the env card shows realistic state on first
      // paint (matches what build.js would return at scenario start).
      config: {
        appVersion: "v1.0.0", logLevel: "debug", featureFlags: [],
        regionLabel: "us-east-1", failoverRegion: "us-west-2",
        zone: "iad-1", env: "dev", tier: "dev",
      },
    },
    staging: {
      name: "staging", tier: "staging",
      region: "us-east-1", datacenter: "iad-2",
      source: { branch: "staging", path: "build.js" },
      version: "v1.0.0", artifactId: "seed-staging",
      lineage: ["staging"], lastDeploy: "seed",
      config: {
        appVersion: "v1.0.0", logLevel: "info", featureFlags: [],
        regionLabel: "us-east-1", failoverRegion: "us-west-2",
        zone: "iad-2", env: "staging", tier: "staging",
      },
    },
    prod: {
      name: "prod", tier: "prod",
      region: "us-west-2", datacenter: "pdx-1",
      source: { branch: "prod", path: "build.js" },
      version: "v1.0.0", artifactId: "seed-prod",
      lineage: ["prod"], lastDeploy: "seed",
      config: {
        appVersion: "v1.0.0", logLevel: "warn", featureFlags: [],
        regionLabel: "us-west-2", failoverRegion: "us-east-1",
        zone: "pdx-1", env: "prod", tier: "prod",
      },
    },
  };

  const envOrder = ["dev", "staging", "prod"];

  // Each branch contains the same set of files (initially).
  const branches = {
    dev:     { ...layeredFiles, "envs.json": window.renderEnvsJson(envs, envOrder) },
    staging: { ...layeredFiles, "envs.json": window.renderEnvsJson(envs, envOrder) },
    prod:    { ...layeredFiles, "envs.json": window.renderEnvsJson(envs, envOrder) },
  };

  window.defineScenario({
    id: "s3-branch-per-env",
    title: "branch per env, layered build",
    summary: "Each env's source is build.js on its own branch. Promotion copies the whole branch forward. The script merges defaults / region / datacenter / env layers.",
    premise: [
      "You're shipping appVersion v1.1.0 with a new feature flag (\"new-checkout\") to all three envs. Your platform uses branch-per-env: each env's source points at build.js on its OWN branch (dev → dev branch, staging → staging branch, prod → prod branch).",
      "",
      "build.js is a real script that merges four layers when it runs:",
      "  defaults.json  →  region/<env.region>.json  →  dc/<env.datacenter>.json  →  env/<env.name>.json",
      "",
      "Most-specific wins. So prod (us-west-2 / pdx-1) gets a different region label and zone than dev (us-east-1 / iad-1), even though the script is identical.",
      "",
      "Promotion is configured to copy the entire source branch onto the target branch. Edit dev's branch to ship the version + flag; promote dev → staging (copies the dev branch onto the staging branch); deploy staging; repeat for prod. Each deploy re-runs the script with that env's identity.",
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
    // Expected resolved config per env at scenario completion. Per-env
    // values reflect the full layered merge (defaults → region → dc → env)
    // after the appVersion bump and "new-checkout" feature flag have been
    // shipped to dev and copy-branched forward.
    expectedConfig: {
      dev: {
        appVersion: "v1.1.0",
        logLevel: "debug",
        featureFlags: ["new-checkout"],
        regionLabel: "us-east-1",
        failoverRegion: "us-west-2",
        zone: "iad-1",
        env: "dev",
        tier: "dev",
      },
      staging: {
        appVersion: "v1.1.0",
        logLevel: "info",
        featureFlags: ["new-checkout"],
        regionLabel: "us-east-1",
        failoverRegion: "us-west-2",
        zone: "iad-2",
        env: "staging",
        tier: "staging",
      },
      prod: {
        appVersion: "v1.1.0",
        logLevel: "warn",
        featureFlags: ["new-checkout"],
        regionLabel: "us-west-2",
        failoverRegion: "us-east-1",
        zone: "pdx-1",
        env: "prod",
        tier: "prod",
      },
    },
    // No JSON-schema lint for layer files — they're heterogeneous and the
    // editor doesn't have a per-file schema mechanism. (Could be added per-
    // file later.)
    configSchema: null,
    directives: [
      {
        id: "d1", kind: "endpoint",
        label: 'dev.config.appVersion = "v1.1.0"',
        check: ({ env }) => env("dev")?.config?.appVersion === "v1.1.0",
      },
      {
        id: "d2", kind: "endpoint",
        label: 'staging.config.appVersion = "v1.1.0"',
        check: ({ env }) => env("staging")?.config?.appVersion === "v1.1.0",
      },
      {
        id: "d3", kind: "endpoint",
        label: 'prod.config.appVersion = "v1.1.0"',
        check: ({ env }) => env("prod")?.config?.appVersion === "v1.1.0",
      },
      {
        id: "d4", kind: "endpoint",
        label: 'prod.config.regionLabel = "us-west-2"  (region layer)',
        check: ({ env }) => env("prod")?.config?.regionLabel === "us-west-2",
      },
      {
        id: "d5", kind: "endpoint",
        label: 'staging.config.zone = "iad-2"  (datacenter layer)',
        check: ({ env }) => env("staging")?.config?.zone === "iad-2",
      },
      {
        id: "d6", kind: "endpoint",
        label: 'dev.config.logLevel = "debug"  (env overlay)',
        check: ({ env }) => env("dev")?.config?.logLevel === "debug",
      },
      {
        id: "d7", kind: "endpoint",
        label: 'all envs include the "new-checkout" feature flag',
        check: ({ env }) =>
          ["dev", "staging", "prod"].every((n) =>
            (env(n)?.config?.featureFlags || []).includes("new-checkout"),
          ),
      },
      {
        id: "d8", kind: "process",
        label: "defaults.json identical across all three branches at the end",
        check: ({ file }) => {
          const d = file("dev",     "layers/defaults.json");
          const s = file("staging", "layers/defaults.json");
          const p = file("prod",    "layers/defaults.json");
          return d !== null && d === s && s === p;
        },
      },
    ],
  });
})();
