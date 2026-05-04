/* global window */
// Scenario s4-routine-ship — "Routine version bump."
//
// Three envs (dev, staging, prod). The repo is seeded with multiple
// branches and two file layouts so the participant can pick whichever
// promotion strategy they like:
//
//   A) Single-branch, JSON-only             — source = main:config/<env>.json
//   B) Single-branch, with build script     — source = main:build.js
//                                              (script reads main:config/<env>.json)
//   C) Branch-per-env, JSON-only            — source = <env>:config.json
//   D) Branch-per-env, with build script    — source = <env>:build.js
//                                              (script reads <env>:config.json)
//
// Promote effects are declared with `when` guards so only the strategy-
// appropriate effect runs:
//   - copy-file (main:config/<from>.json → main:config/<to>.json) when both
//     envs source from main
//   - copy-branch (<from> → <to>) when envs source from per-env branches
//
// Initial sources default to strategy A. The participant repoints sources
// via the topology env-card pickers to switch.
//
// Mid-flow event: when dev hits v1.1.0, a security advisory fires
// announcing v1.0.1 + the apiTimeoutMs requirement that applies to v1.0.1
// AND v1.1.0. The participant has to satisfy the new expected on every env,
// in whatever way fits their chosen strategy.

(function () {
  const REQ_ID = "apiTimeout-cve-2025-12345";
  const REQUIRED_TIMEOUT = 5000;

  // build.js content used on the main branch — reads per-env config files
  // because main holds all three envs' configs side by side.
  const buildJsForMain =
`// build.js — runs on every deploy that points at it.
// Reads the per-env config file. Whatever keys the config has flow through
// to the resolved config; this script only tags the result with env identity.
export default async function build(env, api) {
  const cfg = await api.readJson(\`config/\${env.name}.json\`);
  return { ...cfg, env: env.name, tier: env.tier };
}
`;

  // build.js content used on a per-env branch — reads the singular config.json
  // because each per-env branch is "that env's own view of the world".
  const buildJsForPerEnv =
`// build.js — runs on every deploy that points at it.
// On a per-env branch, the env's config lives at config.json (singular).
// Whatever keys it has flow through; this script only tags the result.
export default async function build(env, api) {
  const cfg = await api.readJson("config.json");
  return { ...cfg, env: env.name, tier: env.tier };
}
`;

  // Minimal initial config: just the application version. The participant
  // adds keys (and decides where they live) as new requirements arrive.
  const minimalConfig = JSON.stringify({ appVersion: "v1.0.0" }, null, 2);

  // Scenario seeds env definitions before scenario state exists, so build
  // envs.json text from a literal projection (renderEnvsJson reads back the
  // env shape we'll seed below).
  const envs = {
    dev: {
      name: "dev", tier: "dev", region: "us-east-1",
      // Default to strategy A (single-branch, JSON-only).
      source: { branch: "main", path: "config/dev.json" },
      version: "v1.0.0", artifactId: "seed-dev",
      lineage: ["dev"], lastDeploy: "seed",
      config: { appVersion: "v1.0.0" },
    },
    staging: {
      name: "staging", tier: "staging", region: "us-east-1",
      source: { branch: "main", path: "config/staging.json" },
      version: "v1.0.0", artifactId: "seed-staging",
      lineage: ["staging"], lastDeploy: "seed",
      config: { appVersion: "v1.0.0" },
    },
    prod: {
      name: "prod", tier: "prod", region: "us-east-1",
      source: { branch: "main", path: "config/prod.json" },
      version: "v1.0.0", artifactId: "seed-prod",
      lineage: ["prod"], lastDeploy: "seed",
      config: { appVersion: "v1.0.0" },
    },
  };

  const envOrder = ["dev", "staging", "prod"];
  const envsJsonText = window.renderEnvsJson(envs, envOrder);

  // Four branches so the participant can pick any strategy:
  //   - main:    per-env layout (config/dev.json, config/staging.json, ...)
  //   - dev,
  //     staging,
  //     prod:    each holds that env's own world (config.json + build.js)
  const branches = {
    main: {
      "build.js": buildJsForMain,
      "config/dev.json":     minimalConfig,
      "config/staging.json": minimalConfig,
      "config/prod.json":    minimalConfig,
      "envs.json":           envsJsonText,
    },
    dev: {
      "build.js": buildJsForPerEnv,
      "config.json": minimalConfig,
      "envs.json":   envsJsonText,
    },
    staging: {
      "build.js": buildJsForPerEnv,
      "config.json": minimalConfig,
      "envs.json":   envsJsonText,
    },
    prod: {
      "build.js": buildJsForPerEnv,
      "config.json": minimalConfig,
      "envs.json":   envsJsonText,
    },
  };

  window.defineScenario({
    id: "s4-routine-ship",
    title: "routine version bump",
    summary: "Ship v1.1.0 across dev → staging → prod. The repo is seeded with several branches and file layouts — pick whichever organisation feels right.",
    premise: [
      "The dev team handed you v1.1.0 — a routine update. Three envs (dev, staging, prod), all currently at v1.0.0.",
      "",
      "How you organise the configuration is up to you. The repo's seeded with several options:",
      "  • main branch — per-env config files at config/dev.json, config/staging.json, config/prod.json (plus a build.js that reads them).",
      "  • dev / staging / prod branches — each carries a singular config.json plus a build.js that reads it.",
      "",
      "Use the env-card source picker (in the environments | promote | deploy sheet) to point each env wherever you like — JSON file, build script, on main, on a per-env branch — whatever fits your style.",
      "",
      "Get all three envs to v1.1.0.",
    ].join("\n"),
    branches,
    envs,
    envOrder,
    promoteEdges: [
      {
        id: "dev->staging", from: "dev", to: "staging",
        // Two effects, gated by `when` so only the strategy-appropriate one
        // fires. Single-branch strategies (sources on main) → copy-file.
        // Branch-per-env strategies (sources on per-env branches) → copy-branch.
        effects: [
          {
            kind: "copy-file",
            from: { branch: "main", path: "config/dev.json" },
            to:   { branch: "main", path: "config/staging.json" },
            when: ({ fromEnv, toEnv }) =>
              fromEnv.source.branch === "main" && toEnv.source.branch === "main",
          },
          {
            kind: "copy-branch", from: "dev", to: "staging",
            when: ({ fromEnv, toEnv }) =>
              fromEnv.source.branch === "dev" && toEnv.source.branch === "staging",
          },
        ],
      },
      {
        id: "staging->prod", from: "staging", to: "prod",
        effects: [
          {
            kind: "copy-file",
            from: { branch: "main", path: "config/staging.json" },
            to:   { branch: "main", path: "config/prod.json" },
            when: ({ fromEnv, toEnv }) =>
              fromEnv.source.branch === "main" && toEnv.source.branch === "main",
          },
          {
            kind: "copy-branch", from: "staging", to: "prod",
            when: ({ fromEnv, toEnv }) =>
              fromEnv.source.branch === "staging" && toEnv.source.branch === "prod",
          },
        ],
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
        apiTimeoutMs: {
          type: "number",
          description: "API timeout in milliseconds.",
        },
      },
      additionalProperties: true,
    },
    expectedConfigFor: (env, version, ctx) => {
      const base = { appVersion: version };
      const advisoryActive = (ctx?.activeRequirements || []).includes(REQ_ID);
      if (advisoryActive && version !== "v1.0.0") {
        return { ...base, apiTimeoutMs: REQUIRED_TIMEOUT };
      }
      return base;
    },
    triggers: [
      {
        id: "advisory-when-dev-hits-v1.1.0",
        when: ({ state, action }) =>
          action.type === "DEPLOY_RESOLVED" &&
          action.env === "dev" &&
          state.envs.dev?.config?.appVersion === "v1.1.0",
        effect: {
          kind: "announce-requirement",
          id: REQ_ID,
          alert: {
            title: "v1.0.1 published — CVE-2025-12345 (slow-call exhaustion)",
            body: "v1.0.1 patches a slow-call resource exhaustion vulnerability. The patch is config-gated: an application instance is only protected if its resolved config sets apiTimeoutMs to 5000. Without that key (or with a different value), the patch is inert.",
            requires: 'apiTimeoutMs: 5000',
            forward: "v1.1.0 (which you're shipping) does not change the default and does not address the underlying issue in code — any env running v1.0.1 or higher requires the same key in its resolved config.",
          },
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
