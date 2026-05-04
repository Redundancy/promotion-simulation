# Promotion Simulation — Design Summary

A browser-based simulation for exposing DevOps engineers to platform engineering
concepts they haven't encountered yet — particularly around promotion strategies,
configuration scoping, and the structural choices that shape how change propagates
through environments.

This document captures the design decisions reached during initial design
conversations. It is intended to align implementation, not to enumerate features.

> **Working on the code?** Read [TESTING.md](./TESTING.md) before changing
> anything that touches state, persistence, or the topology sheet — it lists
> real bugs we've already shipped and the click-paths that surface them.

---

## What this is, and isn't

This is a **simulation**, not a game. The closest analogues are wargames, medical
sims, and tabletop security exercises. Implications:

- No score, no ranking, no histograms, no leaderboards.
- No "correct" solutions; multiple valid responses per situation.
- The participant inhabits a role; the simulation produces situations faithful
  to that role; the participant's choices have consequences they can observe.
- Replay value is not a goal. Consistency across participants, so teams can
  compare experiences afterward, is a goal.

It is **not** a Zachtronics-style optimization puzzle, despite some surface
similarities. The mechanics may resemble one; the philosophy does not.

## Who it's for

DevOps engineers being exposed to platform engineering concepts they haven't
hit yet on the job. The premise is that you can't easily teach someone the
solution to a problem they've never had — the simulation manufactures the
problem-having experience in a low-stakes setting so the concepts that solve it
become legible.

The participant's role within the simulation is **the platform engineer** — the
person designing and maintaining how configuration and promotion work for their
org. Not the application developer, not the operator using a vendor platform.
They are building (or maintaining) the platform.

## Core philosophy

**The simulation presents situations and validates outcomes. It does not
prescribe structure, recommend solutions, score quality, or interpret choices.**

A few load-bearing principles that follow:

- **The simplest solution that works is the right solution at that time.**
  Duplication is not failure. A participant who solves a scenario by adding
  more files has produced a working system. The simulation does not nudge
  toward "better" structures.
- **Pain comes from situations, not from the simulation's opinions.** When a
  participant's structure is awkward for a new requirement, the awkwardness is
  information about fit, not a verdict on prior choices.
- **Directives describe outcomes, not structure.** "Prod must have property X"
  is a directive; "use a base layer with overlays" is not. The participant
  satisfies directives in whatever way they choose.
- **The participant authors the platform.** Configuration content, scripts
  that produce configuration, env definitions, and promotion effects are all
  theirs. The simulation provides primitives, not a ready-made platform.

## The one normative position

Every other decision is the participant's. There is exactly one opinionated
stance the simulation takes:

> **Promotion should not require manual changes to configuration.**

This is not stated as a rule. It is **enacted** by the simulation's mechanics:
the promote button moves application artifacts between environments along with
participant-defined effects, and the participant cannot insert manual config
edits into that flow. They can deploy config changes separately (and must, when
config needs to change) — but those are *deploys*, not promotions. The
distinction is mechanical, not rhetorical.

The norm propagates: identical artifacts across environments, configuration as
code, and auditability all follow from the mechanics enforcing this single
position.

## The world the participant inhabits

### Three observable places

The simulation makes three kinds of state visible, and their distinctness is
load-bearing:

1. **The repo.** Files the participant authors: configuration content (static
   JSON), scripts (JS that produces JSON), env definitions (which point each
   env at a source), promotion effect definitions, and the structure organizing
   all of them. The repo has history; edits are events.
2. **The artifact store.** A filesystem-shaped area where:
    - Application artifacts appear from offstage (the dev team produces them;
      the participant observes them arriving).
    - External configuration artifacts (modules, shared values, etc.) appear
      from offstage and may be referenced or copied by the participant.
    - The participant may also place things here as part of their promotion
      effects.
3. **Environment state.** Each environment has a current application version
   and a current applied configuration. State has history per env. The
   participant can see, for any env at any moment, what's running there and
   what was running previously.

### Two buttons

- **Deploy** takes a target environment, runs the source that env is currently
  pointing at (a static file or a script invoked with the env's properties),
  and applies the resulting JSON as the env's configuration. This is how
  participant-authored changes reach environments.
- **Promote** takes a source and target environment. It moves the application
  artifact from source to target, plus runs any participant-defined effects
  attached to that promotion. Promote does **not** re-run the target's source;
  it carries source's resolved state forward (snapshot semantics). This is
  what makes "lose the hotfix to copy-up" a real and learnable failure mode.

The participant chooses when and which to press. Promotion has no automatic
triggers; it is operator-driven by design.

### How env configuration is produced

This is the core mechanic; everything about strategy and structure lives here.

**Each environment points at a single source.** When the env's configuration
needs to be produced — for validation, for deploy, or for inspection — the
simulation runs that source and the JSON it produces *is* the env's
configuration. There is no resolver layer above this, no merge step the
simulation provides, no composition pipeline. The source is the answer.

A source is one of:

- **A static JSON file** in the repo (on a specified branch and path) or in
  the artifact store (at a specified path). Running it means reading it. The
  file's contents are the env's resolved JSON.
- **A JS script** in the repo (on a specified branch and path). Running it
  means invoking it with the env's properties as input. The script's return
  value is the env's resolved JSON. Scripts can read other files in the repo
  or artifact store as part of their logic, but cannot perform other I/O
  (no network, no clock, no global state). They run sandboxed and are
  expected to be deterministic given their input.

Each env's pointer is itself a piece of state in the repo, defined somewhere
the participant manages. Promotion effects may modify env pointers (e.g., a
promote-to-prod effect that updates prod's pointer to a newly-published
artifact path). Editing an env's pointer is a normal repo edit.

This single mechanic expresses every strategy discussed:

- *Folder-per-env:* each env points at its own static file in the repo.
- *Branch-per-env:* each env points at the same path on different branches.
- *Layered configuration:* an env points at a script that reads multiple files
  and merges them.
- *Attribute-based scoping:* an env points at a script that branches its logic
  on the env's properties.
- *External pinned reference:* an env points at a versioned path in the
  artifact store.
- *External floating reference:* an env points at a moving path (e.g.,
  `latest/`) in the artifact store. The same env, asked to resolve at a
  different time, may produce different JSON.
- *Snapshotting an external reference:* the participant copies the external
  artifact's contents into the repo as a static file, then points the env at
  the repo file.

The lessons about shared scripts, scope discipline, version pinning, and
supply chain risk all live in *how the participant uses this mechanic* —
which sources they create, what their scripts do, which envs share which
sources, and which paths their references point at. The simulation provides
no machinery beyond what's described above.

### Application versions

Application versions appear in environments only through promotion (or, for
hotfixes, by appearing directly in an environment as an out-of-band event).
The participant does not author application versions, does not pick them, and
does not pin them — they are read-only state, observed in the env display.

When a new application version appears, it may bring **new configuration
requirements** with it. The participant doesn't see the application's source or
release notes; they receive directives describing what config the new version
requires. Their job is to ensure their repo structure produces config
satisfying those requirements before (or in coordination with) the version's
arrival in each env.

### Hotfixes

A hotfix is a new application version appearing in an environment without
having been promoted there from another environment. Mechanically: the
simulation drops a version directly into an env's state. This creates a
persistent divergence between that env and the regular promotion flow.

The lesson hotfixes surface is not "hotfixes are special, handle carefully."
It is more general: **a participant's structural choices are tested by whether
they can let environments at different versions coexist without changes
intended for one version contaminating an env running another.** Hotfixes are
the mechanism that produces this divergence sharply.

A related lesson — *the hotfix change can be lost on the next copy-up* —
follows directly from the snapshot semantics of promote. A participant who
fails to persist the hotfix's structural intent in their repo will see future
promotes overwrite it.

### External references

Participant configuration may reference external artifacts (modules, shared
configuration files) that appear in the artifact store from offstage. There
are three structural patterns the participant can use, and each has different
consequences:

- **Snapshot:** copy the external artifact's contents into the repo. The
  participant owns it from then on; upstream changes do not propagate.
- **Pinned reference:** reference the external artifact by version. The
  participant gets exactly that version until they edit the reference;
  upstream publishes do not propagate.
- **Floating reference:** an env points at (or a script reads from) a moving
  path (e.g., `latest/`). The next time the env's source is run, it gets
  whatever the upstream currently publishes; upstream changes propagate
  silently.

The simulation does not prescribe a strategy. Workload events that move
external artifacts surface the consequences of each.

## What the participant authors

Everything in the repo is authored by the participant. The relevant categories:

- **Configuration content.** Static JSON files. Their structure — folder
  layout, branch layout, naming conventions — is the participant's choice.
- **Scripts.** JS files that produce JSON given an env's properties. Used when
  the participant wants logic — layered merging, attribute-based branching,
  computed values — rather than a static file. Scripts are written and edited
  the same way other repo files are.
- **Env definitions.** Small structures specifying, for each environment, what
  source it currently points at. Editing these is how the participant
  redirects an env from one source to another.
- **Promotion effects.** Definitions of what runs alongside the artifact move
  when promote fires — copying branches, copying files in the artifact store,
  updating env pointers, anything the participant chooses to attach.

The first scenario provides minimal starting content (likely a single env
pointing at a single static file). Subsequent scenarios may motivate the
participant to introduce scripts, restructure pointers, change branching
strategies, or otherwise evolve their setup — but the simulation never tells
them to.

## Environments have identity attributes

An environment is not a string. It is a structured object — `{ name, tier,
region, cloud, datacenter, ... }` — and the participant's scripts can key on
any of these attributes. This is what makes attribute-based scoping possible.
A change scoped to `datacenter == "dc1"` affects all envs in dc1, regardless of
tier or region. A change scoped to `tier == "prod" and region == "eu-west-1"`
affects only envs matching both.

Whether the participant *uses* attribute scoping is up to them. The simulation
provides the env identities; the participant decides whether to write scripts
that branch on them, or whether to keep envs pointing at separate static files
that don't share logic.

## Validation

Validation runs over the trace of participant actions and resulting states. It
checks that directives are satisfied — both:

- **Endpoint properties:** at the end of the scenario, env X has property Y.
- **Process properties:** across the history, some property held — e.g.,
  every artifact that reached prod was previously in staging.

Validation never grades. It reports satisfied/unsatisfied per directive, with
enough detail for the participant to investigate. A participant whose envs end
in the right state has succeeded, regardless of how baroque or elegant the path
to get there was.

## Pedagogy: two channels of context, both optional

The simulation itself produces only situations, traces, and validation results.
It never lectures. Pedagogy lives in two separate channels of external context,
both optional from the participant's perspective.

### Scenario-level context (authored)

Each scenario has accompanying material describing the kind of problem it
represents — links to external reading, framing about what categories of
practice this kind of situation sits in, why the situation arises in real
teams. Authored once per scenario, by the scenario author. Static across
participants.

This is where the simulation's thesis lives. Discussions of why the
promotion-without-manual-changes norm matters, what the trade-offs of
different scoping strategies are, what supply chain risk means — all of it
is here, attached to the scenarios where it's relevant, with reasoning visible.

The simulation engine does not carry this material; it carries pointers to it.

### Solution-level observations (emitted)

When the simulation recognizes a pattern in what the participant did — they
edited five files for a directive that one place could have satisfied; they've
used per-env files consistently across multiple scenarios; they referenced an
external artifact via a floating path — it can emit a brief, factual
observation. These are observations, not interpretations. They may include a
pointer to relevant external material, but they don't explain.

Solution-level observations are produced by pattern detectors running over the
trace. New patterns can be added to the detector as the simulation grows;
each pattern is a recognizer plus a pointer to material.

### How participants encounter context

Both channels are **available, not pushed**. The participant can pull up
scenario-level material at any point during a scenario as a hint, or after as
debrief reading. Solution-level observations appear with the post-scenario
trace, as factual reflections the participant can engage with or skip.

The principle: reaching for context requires a small deliberate action.
Nothing nags, nothing pops up unsolicited, nothing implies the participant
should be reading anything.

## What the simulation never does

A consolidated list, because consistency on these matters more than any
individual mechanical decision:

- It does not score, grade, rank, or rate solutions.
- It does not call solutions "naive," "wrong," or "suboptimal."
- It does not nudge toward specific patterns during scenarios.
- It does not pop up hints unprompted.
- It does not interpret the participant's choices.
- It does not reward conciseness, elegance, or any other aesthetic property.
- It does not penalize duplication.
- It does not decide for the participant when promotion should happen.
- It does not block "wrong" button presses; it lets actions have consequences.
- It does not embed pedagogy in the simulator engine; pedagogy lives in
  external material the simulator points at.

## Mechanical surface, summarized

For implementation alignment:

- **Storage:** all participant content is JSON files in a versioned tree (the
  repo). The artifact store is a filesystem-shaped area of JSON files keyed
  by path. Env state is a small structured object per env, with history.
- **Runtime:** discrete-stepped simulation. Events arrive (workload, hotfix,
  external publish, directive). Participant takes actions (edit, deploy,
  promote). State updates. Trace records everything.
- **Source execution:** there are two source types. A static file source is
  read directly. A script source is sandboxed JavaScript (likely via Web
  Worker), invoked with the env's attributes as input, expected to return
  JSON. Scripts can read other repo or artifact-store files via a constrained
  API, but cannot perform other I/O — no network, no clock, no
  nondeterminism. A script is a pure function from `(env, readable_files)
  -> JSON`.
- **Validation:** runs over the final state and the trace. Checks directives,
  reports satisfied/unsatisfied with detail.
- **Persistence:** the participant's repo state and scenario progress should
  persist across sessions (browser storage is sufficient; no backend required
  for the MVP). Scenarios carry forward — the participant's repo at the end
  of scenario N is the starting point for scenario N+1.

## What's deferred

Things discussed but explicitly not in the initial scope:

- Sharing solutions or comparing solutions across participants. This requires
  a backend with simulation validation, which is deferred.
- Aggregate statistics across participants.
- Procedurally generated scenarios.
- Multi-participant or facilitated modes.
- Rich UI for visualizing complex repos. Tooling around editing should scale
  gracefully so cognitive load comes from structure, not from UI friction —
  but sophisticated visualizations are not required for the MVP.

## Authoring boundaries

To keep the design coherent over time:

- **Scenarios** are authored as data: starting state, directives, workload
  events, attached scenario-level context. New scenarios can be added without
  changing the engine.
- **Pattern detectors** for solution-level observations are part of the engine
  and grow over time. Each detector is small and independent.
- **Source-execution capabilities** — what a script has access to (reading
  files, env properties, etc.) — should grow only when a scenario genuinely
  requires it. The starting set should be minimal; expressiveness should be
  earned.
- **The promote button's fixed semantics** are the simulation's commitment.
  Changing them is a major decision; everything downstream depends on the
  current shape (snapshot promotion, operator-driven, with participant-defined
  effects).

## Where to start

An MVP worth building is roughly:

1. One environment pointing at one static JSON file. One directive. Establishes
   the loop: situation → repo edit → deploy → validation.
2. Two environments. First multi-env scenario; participant likely creates a
   second file and points the second env at it. It works. Establishes the
   repo's shape.
3. A third env, with a directive about a value that should be the same across
   two of them. Surfaces the question of duplication explicitly. Participant
   may stay with three files or introduce a script.
4. A version transition with new config requirements. Surfaces the relationship
   between application versions and config requirements.
5. A hotfix. Surfaces the divergence problem and the lose-on-copy-up problem.

These five scenarios exercise nearly the full mechanical surface. If they work,
the rest is content.
