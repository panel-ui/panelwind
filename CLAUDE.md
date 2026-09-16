# panelwind

An agent-first ESLint plugin for Expo design systems, published on npm as
[`panelwind`](https://www.npmjs.com/package/panelwind).
GitHub: https://github.com/panel-ui/panelwind

It reads an Expo project's stylesheet, components and variants, and reports
styling that breaks the design system — with an error that names the fix in
terms of what the project already has. It is a sibling of
[PanelUI](https://github.com/panel-ui/PanelUI) and shares its conventions, but it
is not PanelUI-specific: any Expo project styled with Tailwind works, and a
project with `panelui.json` needs no configuration.

## What this repository is

```
packages/panelwind/     the plugin (npm: panelwind)
  src/project/          discovery: config, theme, components, variants, wrappers
  src/sites/            where class strings and style objects are found
  src/grammar/          what a class is, and what kind of change it makes
  src/native/           what a class does on a device
  src/rules/            the seven rules
  scripts/              the generated table, and two scripts for real projects
  test/                 vitest + ESLint's RuleTester, against test/fixtures/app
docs/                   one page per rule, four guides
scripts/check-docs.mjs  the docs-drift gate
```

## The one idea worth keeping

**Never guess what a platform does. Measure it.**

Every question this linter answers about React Native is answered from something
installed, not from memory:

- Which classes exist → the project's own Tailwind, compiling the project's own
  CSS entry. It has to be that entry: `ios:`, `native:` and the safe-area
  utilities come from the stylesheet the styling library ships, and compiling a
  stock Tailwind would report all of them as typos.
- Which properties survive into a native style → generated from React Native's
  own type definitions by `scripts/generate-native-styles.mjs`, with the two
  properties the conversion drops read from the styling library's converter.

This has already paid twice. `cursor` and `userSelect` are real React Native
style properties — a hand-written table would have reported `cursor-pointer` and
`select-none`, which is exactly the kind of confident wrong answer that gets a
linter uninstalled. And the grammar had no entry for `flex`, so `flex-1` and
`flex-row` were refused as misspellings until a run over a real app found it.

So: **when a rule needs to know something about the platform, find the file that
already knows, and read it.** If it cannot be read, say what is unverified.

## Check it against a real project before believing it

The tests prove the rules work on cases written for them. They cannot prove the
rules are quiet on code that was already correct, and a rule that fires hundreds
of times on good code is wrong even when every finding is defensible.

```bash
npm run build --workspace=panelwind
node packages/panelwind/scripts/smoke.mjs ../SomeExpoApp/src     # findings by rule
node packages/panelwind/scripts/classes.mjs ../SomeExpoApp/src   # holes in the grammar
```

Read the output. The `unclassified` list from the second script should be empty;
anything in it is a false positive waiting to happen in `no-restyle`.

## Writing a rule

- One file per rule in `src/rules`, registered in `src/plugin.ts`, with its level
  set in `src/configs.ts`.
- **A rule that cannot answer stands down.** No CSS entry, no theme, no worker —
  warn once through `warnOnce` and return `{}`. Never fail a run because the
  linter could not do its own job.
- **Errors are for what can be proved**; policy is a warning by default. The
  three provable findings are a class that generates nothing, a class React
  Native drops, and a class value the bundler never sees.
- Every message goes through `reporter()` so a project can replace the words and
  so `settings.panelwind.note` is appended. **No message may tell the reader to
  change the linter's configuration** — an agent handed the policy as the fix
  will change the policy.
- Say the fix in the project's own terms: the variants that exist, the sizes that
  exist, the token nearest the colour, the file to add one to.

## Writing the prose

The docs and the messages are the product; the rules are how they are earned.

1. **What it is for**, in a plain sentence.
2. **The constraint**, stated on its own.
3. **The workaround**, where there is one.
4. **The alternative**, linked.

No aphorisms, no arguing towards a verdict, no rhetorical flourishes. Say *why*
where the why changes what somebody does — "a value added while the bundler is
running compiles to nothing until it is restarted" earns its place; the reasoning
that produced an API does not.

**Never name another linter or component library in anything shipped.** Not in
source comments, not in docs, not in commit messages. This project was built by
reading how the problem is solved elsewhere; the artifact describes panelwind on
its own terms.

## Documentation is part of the change

`npm run docs:check` fails when a rule has no page, no row in the README table,
no row in `docs/README.md`, or a `meta.docs.url` pointing somewhere else — and
when a page exists for a rule that does not. A rule change that leaves its page
alone does not land.

## Commands

```bash
npm install
npm run build          # tsdown: dist/index.js, dist/index.d.ts, dist/native-worker.js
npm run typecheck
npm test               # builds first: the worker has to exist on disk to be loaded
npm run docs:check
npm run native:generate   # regenerate the style table; CI fails if it changes
```

The worker is a separate build entry because `new Worker()` needs a file to load;
bundling it into the plugin would leave nothing to point at.

## Git and release

- **Every modification gets its own commit**, as soon as a logical unit is done.
  Conventional Commits: `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`.
- **Never put a `Claude-Session:` URL in a commit message.** This repository is
  public and the link is noise in permanent history. Keep `Co-Authored-By:`.
- Finishing the work and cutting a release are two decisions, and the second is
  the user's. Ask every time; a run of commits with no release is normal.

A release is a tag and a GitHub release. `.github/workflows/publish.yml` fires on
`release: published`, checks the tag against `packages/panelwind/package.json`,
builds, tests and publishes with provenance over npm's trusted publishing — there
is no npm token here. Cutting the release *is* publishing, so never run
`npm publish` by hand.

CI runs typecheck, build, tests, the generated-table drift check and the docs
check on every push and pull request, and repeats build and tests on Node 20.19.
