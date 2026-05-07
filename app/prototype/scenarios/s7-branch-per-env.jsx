/* global window */
// Scenario s7-branch-per-env — "Branch per env, layered build."
//
// Three envs (dev, staging, prod) each pointing at build.js on its own
// branch (one branch per env). build.js merges layered config from same-branch
// files:
//   defaults.json → region/<region>.json → dc/<datacenter>.json → env/<name>.json
// …and derives `loadBalancerHostname` from a composition of layered values.
//
// Promotion ships ALL files from the source branch onto the target branch
// via the `copy-branch` effect declared on each promote edge.
//
// Pedagogical points:
//   - Branch-per-env strategy.
//   - Layered configuration merging (defaults / region / dc / env).
//   - Multiple identity attributes (region AND datacenter) each driving a layer.
//   - Promotion via branch copy.
//   - Derived config as first-class: `loadBalancerHostname` is composed from
//     four other values. If the participant gets the formula wrong, the
//     diff banner highlights it the same way it would for any literal value.

(function () {
  // Constants used by both build.js (in the repo) and expectedConfigFor (in
  // the scenario). The expected function derives values the same way build.js
  // does — no duplication of literal hostnames per env.
  const SERVICE = "checkout-api";
  const FAILOVER = { "us-east-1": "us-west-2", "us-west-2": "us-east-1" };
  const LOG_BY_ENV = { dev: "debug", staging: "info", prod: "warn" };
  const FLAGS_BY_VERSION = { "v1.0.0": [], "v1.1.0": ["new-checkout"] };

  function rootDomainFor(region) { return `${region}.acme.example`; }
  function hostnameFor(env, region, datacenter) {
    return `${SERVICE}.${env}.${datacenter}.${rootDomainFor(region)}`;
  }

  const buildJs =
`${window.BUILD_JS_DOCS}
// In this scenario the script reads four layered files and merges them
// (most-specific wins), then derives a load-balancer hostname from a
// composition of layered values.
export default async function build(env, api) {
  const defaults = await api.readJson("layers/defaults.json");
  const region   = await api.readJson(\`layers/region/\${env.region}.json\`);
  const dc       = await api.readJson(\`layers/dc/\${env.datacenter}.json\`);
  const overlay  = await api.readJson(\`layers/env/\${env.name}.json\`);
  const merged = {
    ...defaults,
    ...region,
    ...dc,
    ...overlay,
    env: env.name,
    tier: env.tier,
  };
  // Derived from a composition of layered values. Get the formula wrong
  // (e.g. wrong separator, wrong order) and it shows up in the diff.
  merged.loadBalancerHostname =
    \`\${merged.serviceName}.\${env.name}.\${env.datacenter}.\${merged.rootDomain}\`;
  return merged;
}
`;

  // Initial layer files. Same content across all three branches at start.
  const layeredFiles = {
    "build.js": buildJs,
    "layers/defaults.json": JSON.stringify({
      appVersion: "v1.0.0",
      logLevel: "info",
      featureFlags: [],
      serviceName: SERVICE,
    }, null, 2),
    "layers/region/us-east-1.json": JSON.stringify({
      regionLabel: "us-east-1",
      failoverRegion: "us-west-2",
      rootDomain: "us-east-1.acme.example",
    }, null, 2),
    "layers/region/us-west-2.json": JSON.stringify({
      regionLabel: "us-west-2",
      failoverRegion: "us-east-1",
      rootDomain: "us-west-2.acme.example",
    }, null, 2),
    "layers/dc/iad-1.json": JSON.stringify({ zone: "iad-1" }, null, 2),
    "layers/dc/iad-2.json": JSON.stringify({ zone: "iad-2" }, null, 2),
    "layers/dc/pdx-1.json": JSON.stringify({ zone: "pdx-1" }, null, 2),
    "layers/env/dev.json":     JSON.stringify({ logLevel: "debug" }, null, 2),
    "layers/env/staging.json": JSON.stringify({}, null, 2),
    "layers/env/prod.json":    JSON.stringify({ logLevel: "warn" }, null, 2),
  };

  // Helper for seeding env.config so the initial UI state matches what
  // build.js would produce on first run. Mirrors the build script's logic.
  function seedConfigFor(envIdentity) {
    const region = envIdentity.region;
    return {
      appVersion: "v1.0.0",
      logLevel: LOG_BY_ENV[envIdentity.name] || "info",
      featureFlags: [],
      serviceName: SERVICE,
      regionLabel: region,
      failoverRegion: FAILOVER[region],
      rootDomain: rootDomainFor(region),
      zone: envIdentity.datacenter,
      env: envIdentity.name,
      tier: envIdentity.tier,
      loadBalancerHostname: hostnameFor(envIdentity.name, region, envIdentity.datacenter),
    };
  }

  const envs = {
    dev: {
      name: "dev", tier: "dev",
      region: "us-east-1", datacenter: "iad-1",
      source: { branch: "dev", path: "build.js" },
      version: "v1.0.0", artifactId: "seed-dev",
      lineage: ["dev"], lastDeploy: "seed",
    },
    staging: {
      name: "staging", tier: "staging",
      region: "us-east-1", datacenter: "iad-2",
      source: { branch: "staging", path: "build.js" },
      version: "v1.0.0", artifactId: "seed-staging",
      lineage: ["staging"], lastDeploy: "seed",
    },
    prod: {
      name: "prod", tier: "prod",
      region: "us-west-2", datacenter: "pdx-1",
      source: { branch: "prod", path: "build.js" },
      version: "v1.0.0", artifactId: "seed-prod",
      lineage: ["prod"], lastDeploy: "seed",
    },
  };
  // Pre-seed config so each env card paints with realistic state on first open.
  for (const e of Object.values(envs)) e.config = seedConfigFor(e);

  const envOrder = ["dev", "staging", "prod"];

  const branches = {
    dev:     { ...layeredFiles },
    staging: { ...layeredFiles },
    prod:    { ...layeredFiles },
  };

  window.defineScenario({
    id: "s7-branch-per-env",
    title: "branch per env, layered build",
    summary: "Each env's source is build.js on its own branch. Promotion copies the whole branch forward. The script merges defaults / region / datacenter / env layers AND derives a load-balancer hostname from their composition.",
    premise: [
      "You're shipping appVersion v1.1.0 with a new feature flag (\"new-checkout\") to all three envs. Your platform uses branch-per-env: each env's source points at build.js on its OWN branch (dev → dev branch, staging → staging branch, prod → prod branch).",
      "",
      "build.js merges four layers when it runs:",
      "  defaults.json  →  region/<env.region>.json  →  dc/<env.datacenter>.json  →  env/<env.name>.json",
      "",
      "It also derives loadBalancerHostname from a composition of values across those layers — so getting the hostname right means getting the formula AND the inputs right.",
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
    configSchema: null,
    // Function form: derives expected from env identity AND running version.
    // Same constants build.js uses; same composition formula. If build.js
    // gets the formula wrong (e.g. wrong separator), the diff highlights
    // loadBalancerHostname.
    expectedConfigFor: (env, version) => {
      const region = env.region;
      return {
        appVersion: version,
        logLevel: LOG_BY_ENV[env.name] || "info",
        featureFlags: FLAGS_BY_VERSION[version] || [],
        serviceName: SERVICE,
        regionLabel: region,
        failoverRegion: FAILOVER[region],
        rootDomain: rootDomainFor(region),
        zone: env.datacenter,
        env: env.name,
        tier: env.tier,
        loadBalancerHostname: hostnameFor(env.name, region, env.datacenter),
      };
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
