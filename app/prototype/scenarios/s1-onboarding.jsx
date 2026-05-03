/* global window */
// Scenario s1-onboarding — "One env, one file."
//
// The minimal scenario from DESIGN.md "Where to start §1": establishes the
// loop situation → repo edit → deploy → validation. Single env, single file,
// single deploy. The work is in reading the dev team's requirements and
// reflecting them faithfully in the JSON — including adding new keys that
// aren't there yet, and getting nested structure right.

(function () {
  const envs = {
    dev: {
      name: "dev", tier: "dev", region: "us-east-1",
      source: { branch: "main", path: "config/dev.json" },
      version: "v0.0.0", artifactId: "seed-dev",
      lineage: ["dev"], lastDeploy: "seed",
    },
  };

  const envOrder = ["dev"];

  // The seed leaves the obvious slots empty and omits the keys the dev team
  // wants entirely — so the participant has to actually edit, not just
  // change a number.
  const initialFiles = {
    "envs.json": window.renderEnvsJson(envs, envOrder),
    "config/dev.json": JSON.stringify(
      {
        appVersion: "",
        siteName: "",
      },
      null, 2,
    ),
  };

  window.defineScenario({
    id: "s1-onboarding",
    title: "one env, one file",
    summary: "You inherit a tiny platform. One environment, one config file, and a list of things the dev team wants set. Edit the file, deploy, validate.",
    premise: [
      "You're the new platform engineer. There's exactly one environment (dev) and one config file (config/dev.json). The dev team has handed you a list of values they need reflected in dev's running config:",
      "",
      "  • appVersion       v1.0.0",
      "  • siteName         Acme Platform",
      "  • supportEmail     help@acme.example",
      "  • limits.maxUploadMB   25",
      "",
      "Some of these keys aren't in the file yet — you'll have to add them. Get them all in, deploy dev, then run validate.",
    ].join("\n"),
    branches: { main: initialFiles },
    envs,
    envOrder,
    promoteEdges: [], // no promotions in a single-env scenario
    topologyNodes: {
      dev: { x: 450, y: 130 },
    },
    // Schema declares the keys the dev team named so the inline lint helps
    // rather than nags. additionalProperties stays open — participants
    // shouldn't be punished for keeping extra keys around if they want.
    configSchema: {
      type: "object",
      required: ["appVersion", "siteName"],
      properties: {
        appVersion: {
          type: "string",
          pattern: "^v\\d+\\.\\d+\\.\\d+$",
          description: "Semantic version, prefixed with 'v'. Example: v1.0.0",
        },
        siteName: {
          type: "string",
          description: "Display name shown to users.",
        },
        supportEmail: {
          type: "string",
          description: "Public-facing support contact.",
        },
        limits: {
          type: "object",
          description: "Numeric limits the application enforces.",
        },
      },
      additionalProperties: true,
    },
    directives: [
      {
        id: "d1", kind: "endpoint",
        label: 'dev.appVersion = "v1.0.0"',
        check: ({ env, source }) =>
          env("dev")?.version === "v1.0.0" &&
          source("dev")?.appVersion === "v1.0.0",
      },
      {
        id: "d2", kind: "endpoint",
        label: 'dev.siteName = "Acme Platform"',
        check: ({ source }) => source("dev")?.siteName === "Acme Platform",
      },
      {
        id: "d3", kind: "endpoint",
        label: 'dev.supportEmail = "help@acme.example"',
        check: ({ source }) => source("dev")?.supportEmail === "help@acme.example",
      },
      {
        id: "d4", kind: "endpoint",
        label: "dev.limits.maxUploadMB = 25",
        check: ({ source }) => source("dev")?.limits?.maxUploadMB === 25,
      },
      {
        id: "d5", kind: "process",
        label: "dev's deployed config matches its source",
        check: ({ env, source }) => {
          const e = env("dev");
          const cfg = source("dev");
          if (!e || !cfg) return false;
          // The participant must press deploy after their edits — this fails
          // if they edit the source but never deploy.
          return e.version === cfg.appVersion;
        },
      },
    ],
  });
})();
