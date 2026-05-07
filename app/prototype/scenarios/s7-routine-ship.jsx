/* global window */
// Scenario s7-routine-ship — "Routine version bump."
//
// Three envs (dev, staging, prod). The repo seed is intentionally minimal:
// just the main branch with one config file per env, plus default copy-file
// promote effects. The participant decides everything else — whether to
// stay on main or create per-env branches; whether to use a build script;
// what shape the config takes; what each promote edge actually does.
//
// Promotion strategies the participant can build out of this:
//   A) Stay on main with per-env JSON files (default — works out of the box)
//   B) Add a main:build.js, repoint sources to it, edit the config files
//      it reads
//   C) Create dev/staging/prod branches (from main), repoint sources to
//      <env>:config/<env>.json (or whatever they put there), swap promote
//      effects to copy-branch
//   D) Anything in between
//
// Mid-flow: when dev hits v1.1.0, a security advisory fires (CVE-2025-12345
// patched by setting apiTimeoutMs: 5000 in resolved config). The advisory
// applies to v1.0.1 and later, including v1.1.0 — the participant has to
// thread the new value through whatever structure they chose.

(function () {
  const REQ_ID = "apiTimeout-cve-2025-12345";
  const REQUIRED_TIMEOUT = 5000;

  // Env-specific config values that the simulator expects across the
  // participant's whole run. Pre-seeded into each env's config file (so the
  // initial state is in-spec) and re-checked by expectedConfigFor below
  // (so any drift after a naive promote shows up immediately).
  const LOG_BY_ENV     = { dev: "debug", staging: "info", prod: "warn" };
  const REPLICAS_BY_ENV = { dev: 1,       staging: 2,      prod: 5      };

  function seededConfig(envName, version) {
    return {
      appVersion: version,
      logLevel: LOG_BY_ENV[envName],
      replicas: REPLICAS_BY_ENV[envName],
    };
  }

  function configFileText(envName) {
    return JSON.stringify(seededConfig(envName, "v1.0.0"), null, 2);
  }

  const envs = {
    dev: {
      name: "dev", tier: "dev", region: "us-east-1",
      source: { branch: "main", path: "config/dev.json" },
      version: "v1.0.0", artifactId: "seed-dev",
      lineage: ["dev"], lastDeploy: "seed",
      config: seededConfig("dev", "v1.0.0"),
    },
    staging: {
      name: "staging", tier: "staging", region: "us-east-1",
      source: { branch: "main", path: "config/staging.json" },
      version: "v1.0.0", artifactId: "seed-staging",
      lineage: ["staging"], lastDeploy: "seed",
      config: seededConfig("staging", "v1.0.0"),
    },
    prod: {
      name: "prod", tier: "prod", region: "us-east-1",
      source: { branch: "main", path: "config/prod.json" },
      version: "v1.0.0", artifactId: "seed-prod",
      lineage: ["prod"], lastDeploy: "seed",
      config: seededConfig("prod", "v1.0.0"),
    },
  };

  const envOrder = ["dev", "staging", "prod"];

  // Single branch; participant creates more (or doesn't) via the file tree.
  const branches = {
    main: {
      "config/dev.json":     configFileText("dev"),
      "config/staging.json": configFileText("staging"),
      "config/prod.json":    configFileText("prod"),
    },
  };

  window.defineScenario({
    id: "s7-routine-ship",
    title: "routine version bump",
    summary: "Ship v1.1.0 across dev → staging → prod. The repo starts minimal — you build the structure that fits your strategy.",
    premise: [
      "The dev team handed you v1.1.0 — a routine update. Three envs (dev, staging, prod), all currently at v1.0.0.",
      "",
      "The repo is one branch (main) with one config file per env. Each env has its own quirks (different log levels, different replica counts) baked into its config. The promotion paths dev → staging → prod are declared but have NO effects configured — promote does nothing until you wire it up.",
      "",
      "Build out whatever structure fits. Create branches, create or delete files, configure promote effects, repoint env sources — all via the repo and topology panels. Get all three envs to v1.1.0 with their per-env values intact.",
    ].join("\n"),
    branches,
    envs,
    envOrder,
    // Promotion paths are scenario-defined; effects are participant-defined.
    // No effects seeded — promote is a no-op until the participant adds
    // explicit effects (copy-file / copy-branch) in the topology editor.
    // Without effects they can still ship by editing each env's config
    // by hand and deploying — promote is a power tool they configure when
    // they want it to do work for them.
    promoteEdges: [
      { id: "dev->staging",  from: "dev",     to: "staging", effects: [] },
      { id: "staging->prod", from: "staging", to: "prod",    effects: [] },
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
      // Per-env values: each env has a different logLevel and replica count
      // (think dev wants verbose logs and a single instance, prod wants
      // quieter logs and headroom). A naive copy-file promote ships the
      // source env's values forward — overwriting the target's per-env
      // values until the participant fixes them. The participant decides
      // how to handle that: edit each file by hand, refactor to a build
      // script that branches on env identity, or use branch-per-env.
      const base = {
        appVersion: version,
        logLevel: LOG_BY_ENV[env.name],
        replicas: REPLICAS_BY_ENV[env.name],
      };
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
