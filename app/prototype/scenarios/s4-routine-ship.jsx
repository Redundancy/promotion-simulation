/* global window */
// Scenario s4-routine-ship — "Routine version bump."
//
// Three envs (dev, staging, prod) all on the main branch with a shared
// build.js that reads each env's per-env config file. Initial config is
// minimal — the participant decides how to evolve it.
//
// The premise looks like a routine v1.0.0 → v1.1.0 ship. But mid-flow,
// when dev hits v1.1.0, a security advisory fires: a new application
// version (v1.0.1) has been published with a CVE patch that's gated by a
// config key. v1.1.0 (already in flight) still requires the same key —
// the patch is config-driven, not code-driven. Once the advisory is
// active, every env's expected includes that key, and the diff banner /
// promote gate will catch any env where it's missing.
//
// What this exercises:
//   - The participant has minimal scaffolding to start with — they have to
//     decide what shape config takes as new requirements land.
//   - Mid-flow events (the advisory) force them to react in the middle of
//     a ship rather than plan everything up front.
//   - The persistence test: once a value is required everywhere, every
//     env's config file has to carry it forward through promotion. A naive
//     "edit only dev, ship through" works because copy-file effects carry
//     dev's content to staging then to prod — but only if the value is in
//     dev's file in the first place.

(function () {
  const REQ_ID = "apiTimeout-cve-2025-12345";
  const REQUIRED_TIMEOUT = 5000;

  const buildJs =
`// build.js — runs on every deploy.
// Reads the env-specific config file. Whatever keys the participant adds
// to that file flow through to the resolved config; the script only tags
// the result with env identity.
export default async function build(env, api) {
  const cfg = await api.readJson(\`config/\${env.name}.json\`);
  return { ...cfg, env: env.name, tier: env.tier };
}
`;

  // Minimal initial config: just the application version. The participant
  // adds whatever keys they need as the scenario unfolds.
  const minimalConfig = (version) => JSON.stringify({ appVersion: version }, null, 2);

  const initialFiles = {
    "build.js": buildJs,
    "config/dev.json":     minimalConfig("v1.0.0"),
    "config/staging.json": minimalConfig("v1.0.0"),
    "config/prod.json":    minimalConfig("v1.0.0"),
  };

  const envs = {
    dev: {
      name: "dev", tier: "dev", region: "us-east-1",
      source: { branch: "main", path: "build.js" },
      version: "v1.0.0", artifactId: "seed-dev",
      lineage: ["dev"], lastDeploy: "seed",
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
    summary: "Ship v1.1.0 across dev → staging → prod. Each env has its own (almost empty) config file; promote copies the source env's file forward.",
    premise: [
      "The dev team handed you v1.1.0 — a routine update. Three envs (dev, staging, prod), all currently at v1.0.0. Each env has its own config/<env>.json file, currently containing just the appVersion.",
      "",
      "Your job: get all three envs to v1.1.0. Build the config however you like as you go.",
    ].join("\n"),
    branches: { main: { ...initialFiles, "envs.json": window.renderEnvsJson(envs, envOrder) } },
    envs,
    envOrder,
    promoteEdges: [
      {
        id: "dev->staging", from: "dev", to: "staging",
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
        apiTimeoutMs: {
          type: "number",
          description: "API timeout in milliseconds.",
        },
      },
      additionalProperties: true,
    },
    // Expected is a function of (env, version, ctx). The advisory flips on
    // a requirement that adds apiTimeoutMs to expected for every env at
    // any version >= v1.0.1 (the patched version). v1.0.0 is unaffected
    // because nobody's asking that envs at the old version satisfy the new
    // patch — they're about to be replaced.
    expectedConfigFor: (env, version, ctx) => {
      const base = { appVersion: version, env: env.name, tier: env.tier };
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
