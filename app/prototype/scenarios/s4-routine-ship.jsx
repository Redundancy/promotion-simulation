/* global window */
// Scenario s4-routine-ship — "Routine version bump."
//
// Three envs (dev, staging, prod) all on the main branch with a shared
// build.js that reads each env's per-env config file. The premise looks
// like a routine v1.0.0 → v1.1.0 ship.
//
// What the participant doesn't know up front: a trigger fires when staging
// reaches v1.1.0 — the simulation drops a v1.0.1 hotfix directly into prod's
// state (no repo file changes), with a configPatch that adds a `hotfix` key.
// expectedConfigFor is version-keyed: prod at v1.0.1 expects `hotfix`, prod
// at v1.1.0 ALSO expects `hotfix` (the underlying issue isn't fixed by the
// version bump — the hotfix value must be preserved across the upgrade).
//
// This is the "lose-on-copy-up" lesson from DESIGN.md §"Hotfixes". A naive
// promote of staging's source to prod will land prod at v1.1.0 without the
// hotfix key — the diff banner will scream and the directives will fail.
// The participant has to persist the hotfix value into the repo somewhere
// the next promote will carry forward.

(function () {
  const HOTFIX_VAL = "patched-cve-2025-12345";

  const buildJs =
`// build.js — runs on every deploy.
// Reads the env-specific config file. Whatever extra keys the participant
// adds to that file (e.g. to preserve a hotfix value) will flow through.
export default async function build(env, api) {
  const cfg = await api.readJson(\`config/\${env.name}.json\`);
  return { ...cfg, env: env.name, tier: env.tier };
}
`;

  const initialFiles = {
    "build.js": buildJs,
    "config/dev.json":     JSON.stringify({ appVersion: "v1.0.0" }, null, 2),
    "config/staging.json": JSON.stringify({ appVersion: "v1.0.0" }, null, 2),
    "config/prod.json":    JSON.stringify({ appVersion: "v1.0.0" }, null, 2),
  };

  const envs = {
    dev: {
      name: "dev", tier: "dev", region: "us-east-1",
      source: { branch: "main", path: "build.js" },
      version: "v1.0.0", artifactId: "seed-dev",
      lineage: ["dev"], lastDeploy: "seed",
      // Pre-seed config so the env card paints with realistic state.
      config: { appVersion: "v1.0.0", env: "dev", tier: "dev" },
    },
    staging: {
      name: "staging", tier: "staging", region: "us-east-1",
      source: { branch: "main", path: "build.js" },
      version: "v1.0.0", artifactId: "seed-staging",
      lineage: ["staging"], lastDeploy: "seed",
      config: { appVersion: "v1.0.0", env: "staging", tier: "staging" },
    },
    prod: {
      name: "prod", tier: "prod", region: "us-east-1",
      source: { branch: "main", path: "build.js" },
      version: "v1.0.0", artifactId: "seed-prod",
      lineage: ["prod"], lastDeploy: "seed",
      config: { appVersion: "v1.0.0", env: "prod", tier: "prod" },
    },
  };

  const envOrder = ["dev", "staging", "prod"];

  window.defineScenario({
    id: "s4-routine-ship",
    title: "routine version bump",
    summary: "Ship v1.1.0 across dev → staging → prod. Each env has its own config file; promote copies the source env's file forward.",
    premise: [
      "The dev team handed you v1.1.0 — a routine update. Three envs (dev, staging, prod), all currently at v1.0.0. Each env has its own config/<env>.json file; promote copies the source env's file forward.",
      "",
      "Your job: get all three envs to v1.1.0.",
    ].join("\n"),
    branches: { main: { ...initialFiles, "envs.json": window.renderEnvsJson(envs, envOrder) } },
    envs,
    envOrder,
    promoteEdges: [
      {
        id: "dev->staging", from: "dev", to: "staging",
        // Explicit copy-file effects per edge so the source-of-truth-per-env
        // semantics are obvious in the trace.
        effects: [{ kind: "copy-file",
                    from: { branch: "main", path: "config/dev.json" },
                    to:   { branch: "main", path: "config/staging.json" } }],
      },
      {
        id: "staging->prod", from: "staging", to: "prod",
        effects: [{ kind: "copy-file",
                    from: { branch: "main", path: "config/staging.json" },
                    to:   { branch: "main", path: "config/prod.json" } }],
      },
    ],
    topologyNodes: {
      dev:     { x: 200, y: 130 },
      staging: { x: 470, y: 130 },
      prod:    { x: 760, y: 130 },
    },
    configSchema: {
      type: "object",
      required: ["appVersion"],
      properties: {
        appVersion: {
          type: "string",
          pattern: "^v\\d+\\.\\d+\\.\\d+$",
          description: "Semantic version. Example: v1.1.0",
        },
      },
      additionalProperties: true,
    },
    // Version-keyed expected:
    //   - All envs at v1.0.0 expect just appVersion.
    //   - All envs at v1.1.0 expect just appVersion (for dev/staging).
    //   - Prod at v1.0.1 (post-hotfix) AND v1.1.0 expects { appVersion, hotfix }.
    //     The hotfix's required key persists across the version bump — the
    //     underlying CVE is patched at the platform level via that config key,
    //     not via the application version.
    expectedConfigFor: (env, version) => {
      const base = { appVersion: version, env: env.name, tier: env.tier };
      if (env.name === "prod" && (version === "v1.0.1" || version === "v1.1.0")) {
        return { ...base, hotfix: HOTFIX_VAL };
      }
      return base;
    },
    // The trigger that surfaces the hotfix-during-promotion lesson. Fires
    // exactly once when staging deploys at v1.1.0. (Why staging and not dev?
    // Realistic: the hotfix happened in prod after staging was already
    // running v1.1.0, so the participant already had the new version one
    // hop away when the security event hit.)
    triggers: [
      {
        id: "hotfix-when-staging-hits-v1.1.0",
        when: ({ state, action }) =>
          action.type === "DEPLOY_RESOLVED" &&
          action.env === "staging" &&
          state.envs.staging?.config?.appVersion === "v1.1.0",
        effect: {
          kind: "inject-hotfix",
          env: "prod",
          version: "v1.0.1",
          configPatch: { hotfix: HOTFIX_VAL },
          message: "security patched a CVE in prod (preserve `hotfix` through the v1.1.0 ship)",
        },
        once: true,
      },
    ],
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
    ],
  });
})();
