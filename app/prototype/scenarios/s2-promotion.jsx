/* global window */
// Scenario s2-promotion — "Ship a version bump from dev to prod."
// Three envs, one shared value (appVersion). Goal: get all envs to v1.1.0
// with prod's artifact having previously landed in staging.

(function () {
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
    prod: {
      name: "prod", tier: "prod", region: "us-east-1",
      source: { branch: "main", path: "config/prod.json" },
      version: "v1.0.0", artifactId: "seed-prod",
      lineage: ["prod"], lastDeploy: "seed",
    },
  };

  const envOrder = ["dev", "staging", "prod"];

  const initialFiles = {
    "config/dev.json":     JSON.stringify({ appVersion: "v1.0.0" }, null, 2),
    "config/staging.json": JSON.stringify({ appVersion: "v1.0.0" }, null, 2),
    "config/prod.json":    JSON.stringify({ appVersion: "v1.0.0" }, null, 2),
    "scripts/build.js":
`// scripts/build.js
// runs on every deploy to produce an artifact from the source config.
export default function build({ env, source }) {
  return {
    id: \`\${env.name}-\${source.appVersion}-\${Date.now()}\`,
    tag: source.appVersion,
    builtAt: new Date().toISOString(),
    env: env.name,
  };
}
`,
  };

  window.defineScenario({
    id: "s2-promotion",
    title: "configure your first promotion",
    summary: "Three envs, three files, two promote edges with no effects yet. Configure copy-file effects so promotion ships your changes forward.",
    premise: [
      "You're shipping v1.1.0 to production. Three environments — dev, staging, prod — all currently at v1.0.0. Each env has its own JSON config file in the repo:",
      "",
      "  dev      sources main:config/dev.json",
      "  staging  sources main:config/staging.json",
      "  prod     sources main:config/prod.json",
      "",
      "Promote edges are wired into the topology (dev → staging → prod) but have NO EFFECTS configured yet. As-is, pressing promote just records lineage; it doesn't move any files. To make promote actually ship your change forward, you'll need to configure each edge.",
      "",
      "Walkthrough:",
      "",
      "  1. Click the topbar's 'environments | promote | deploy' button to open the topology.",
      "  2. Below the env graph you'll see PROMOTE EFFECTS — one row per edge, each currently saying 'no effects · promote will be a no-op'. Click '+ effect' on the dev → staging row.",
      "  3. Pick kind: copy-file. Set FROM = main : config/dev.json, TO = main : config/staging.json. Save.",
      "  4. Repeat for staging → prod (FROM = main : config/staging.json, TO = main : config/prod.json).",
      "  5. Close the topology (esc), edit config/dev.json to bump appVersion to v1.1.0, deploy dev.",
      "  6. Promote dev → staging — the copy-file effect ships dev.json's contents onto staging.json. Deploy staging.",
      "  7. Promote staging → prod, deploy prod.",
      "",
      "The lineage directive ensures every prod artifact came through staging. With effects configured, promote does the actual file move; without them, you'd be hand-editing each file.",
    ].join("\n"),
    branches: { main: initialFiles },
    envs,
    envOrder,
    promoteEdges: [
      { id: "dev->staging",  from: "dev",     to: "staging", effects: [] },
      { id: "staging->prod", from: "staging", to: "prod",    effects: [] },
    ],
    // All three envs should end up at v1.1.0.
    expectedConfig: {
      dev:     { appVersion: "v1.1.0" },
      staging: { appVersion: "v1.1.0" },
      prod:    { appVersion: "v1.1.0" },
    },
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
          description: "Semantic version, prefixed with 'v'. Example: v1.1.0",
        },
      },
      additionalProperties: false,
    },
    directives: [
      {
        id: "d1", kind: "endpoint",
        label: 'dev.appVersion = "v1.1.0"',
        check: ({ env, source }) =>
          env("dev")?.version === "v1.1.0" &&
          source("dev")?.appVersion === "v1.1.0",
      },
      {
        id: "d2", kind: "endpoint",
        label: 'staging.appVersion = "v1.1.0"',
        check: ({ env, source }) =>
          env("staging")?.version === "v1.1.0" &&
          source("staging")?.appVersion === "v1.1.0",
      },
      {
        id: "d3", kind: "endpoint",
        label: 'prod.appVersion = "v1.1.0"',
        check: ({ env, source }) =>
          env("prod")?.version === "v1.1.0" &&
          source("prod")?.appVersion === "v1.1.0",
      },
      {
        id: "d4", kind: "process",
        label: "every artifact in prod was previously in staging",
        check: ({ env }) => {
          const lin = env("prod")?.lineage || [];
          return lin.includes("staging") && lin.indexOf("staging") < lin.lastIndexOf("prod");
        },
      },
    ],
  });
})();
