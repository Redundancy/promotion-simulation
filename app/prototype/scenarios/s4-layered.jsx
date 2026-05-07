/* global window */
// Scenario s4-layered — "Shared defaults, per-env overrides."
//
// Adds layered (override-wins) merging on top of the build.js skill from s3.
// Shared values live in defaults.json once; per-env overrides live in tiny
// override files. The script merges them.
//
// FORCING FUNCTION: the seeded build.js reads only defaults.json — it
// IGNORES the override files. The override files exist with debug/warn
// values, but they're inert until the participant teaches build.js to
// read and merge them. Directives require per-env logLevel, so the
// participant must extend the script. They learn the merge pattern by
// implementing it.
//
// Pedagogical points:
//   - Layered merging: defaults overridden by env-specific values.
//   - api.readJson() with a path templated on env identity.
//   - Object-spread merge order; "most-specific wins."
//   - Empty override files are valid (staging.json is {}).

(function () {
  const SERVICE = "checkout-api";
  const LOG_BY_ENV = { dev: "debug", staging: "info", prod: "warn" };

  const buildJs =
`${window.BUILD_JS_DOCS}
// ─────────────────────────────────────────────────────────────────────
// TODO for the participant
// ─────────────────────────────────────────────────────────────────────
// Right now this script reads ONLY config/defaults.json and returns it.
// That means every env gets the same logLevel ("info" — the default).
//
// But there are per-env override files in the repo, and the dev team
// wants them honored:
//
//   config/env/dev.json     →  { "logLevel": "debug" }
//   config/env/staging.json →  { }                       (empty: keep default)
//   config/env/prod.json    →  { "logLevel": "warn"  }
//
// Extend the script: read the env's override file, then merge it ON TOP
// of defaults so override values win where they specify a key.
//
// Hint: the file API gives you api.readJson(path), and you can build the
// per-env path with a template literal: \`config/env/\${env.name}.json\`.
// ─────────────────────────────────────────────────────────────────────
export default async function build(env, api) {
  const defaults = await api.readJson("config/defaults.json");
  return defaults;
}
`;

  const initialFiles = {
    "build.js": buildJs,
    "config/defaults.json": JSON.stringify({
      serviceName: SERVICE,
      appVersion: "v1.0.0",
      logLevel: "info",
      featureFlags: [],
    }, null, 2),
    "config/env/dev.json":     JSON.stringify({ logLevel: "debug" }, null, 2),
    "config/env/staging.json": JSON.stringify({}, null, 2),
    "config/env/prod.json":    JSON.stringify({ logLevel: "warn" }, null, 2),
  };

  // Mirrors the SEEDED (incomplete) build.js. Returns just defaults — no
  // overlay. The expected pane will diff this against the full expected
  // (with per-env logLevel), surfacing what the participant has to fix.
  function seedConfigFor(envIdentity, version) {
    return {
      serviceName: SERVICE,
      appVersion: version,
      logLevel: "info", // defaults' value, since seed script ignores overlay
      featureFlags: [],
    };
  }

  const envs = {
    dev: {
      name: "dev", tier: "dev", region: "us-east-1",
      source: { branch: "main", path: "build.js" },
      version: "v1.0.0", artifactId: "seed-dev",
      lineage: ["dev"], lastDeploy: "seed",
    },
    staging: {
      name: "staging", tier: "staging", region: "us-east-1",
      source: { branch: "main", path: "build.js" },
      version: "v1.0.0", artifactId: "seed-staging",
      lineage: ["staging"], lastDeploy: "seed",
    },
    prod: {
      name: "prod", tier: "prod", region: "us-east-1",
      source: { branch: "main", path: "build.js" },
      version: "v1.0.0", artifactId: "seed-prod",
      lineage: ["prod"], lastDeploy: "seed",
    },
  };
  for (const e of Object.values(envs)) e.config = seedConfigFor(e, e.version);

  const envOrder = ["dev", "staging", "prod"];

  const branches = { main: { ...initialFiles } };

  window.defineScenario({
    id: "s4-layered",
    title: "shared defaults, per-env overrides",
    summary: "build.js merges a shared defaults file with a tiny per-env override. The seeded script ignores the overrides — you teach it to merge them.",
    premise: [
      "You're shipping v1.1.0 to all three envs. Most config is the same everywhere — only logLevel varies. So instead of copy-pasting values into three files, the repo has:",
      "",
      "  • config/defaults.json  — shared values (serviceName, appVersion, featureFlags, default logLevel).",
      "  • config/env/<name>.json — TINY per-env override files. dev sets logLevel:debug; prod sets logLevel:warn; staging is {} (uses the default).",
      "",
      "Open build.js: there's a TODO at the top. The seeded script reads ONLY defaults.json and ignores the override files. As a result every env gets logLevel:info, but the dev team needs dev:debug and prod:warn. Extend the script to read the per-env override and merge it on top of defaults.",
      "",
      "Then bump appVersion to v1.1.0 in defaults.json (ONE edit) and redeploy each env. The new version flows to every env on its next deploy.",
    ].join("\n"),
    branches,
    envs,
    envOrder,
    promoteEdges: [
      { id: "dev->staging", from: "dev", to: "staging", effects: [] },
      { id: "staging->prod", from: "staging", to: "prod", effects: [] },
    ],
    topologyNodes: {
      dev:     { x: 200, y: 130 },
      staging: { x: 470, y: 130 },
      prod:    { x: 760, y: 130 },
    },
    configSchema: null,
    expectedConfigFor: (env, version) => ({
      serviceName: SERVICE,
      appVersion: version,
      logLevel: LOG_BY_ENV[env.name] || "info",
      featureFlags: [],
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
        label: "config/defaults.json holds appVersion v1.1.0 (shared edit, not three copies)",
        check: ({ file }) => {
          const text = file("main", "config/defaults.json");
          if (!text) return false;
          try {
            return JSON.parse(text)?.appVersion === "v1.1.0";
          } catch { return false; }
        },
      },
    ],
  });
})();
