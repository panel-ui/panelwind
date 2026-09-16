<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://shieldcn.dev/header/surface.svg?title=panelwind&amp;subtitle=Design+system+rules+your+agent+can+verify&amp;mode=dark&amp;align=center&amp;font=geist-mono&amp;border=false" />
    <img alt="panelwind — design system rules your agent can verify" src="https://shieldcn.dev/header/surface.svg?title=panelwind&amp;subtitle=Design+system+rules+your+agent+can+verify&amp;mode=light&amp;align=center&amp;font=geist-mono&amp;border=false" />
  </picture>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/panelwind"><img alt="npm version and monthly downloads" src="https://shieldcn.dev/group/npm/v/panelwind+npm/dm/panelwind.svg?variant=branded&amp;size=xs" /></a>
  <a href="https://github.com/panel-ui/panelwind"><img alt="GitHub stars, license, contributors and last commit" src="https://shieldcn.dev/group/github/panel-ui/panelwind/stars+github/panel-ui/panelwind/license+github/panel-ui/panelwind/contributors+github/panel-ui/panelwind/last-commit.svg?variant=branded&amp;size=xs" /></a>
</p>

<p align="center">
  An ESLint plugin for Expo · Reads your theme, components and variants · Knows what a class does on a device
</p>

<p align="center">
  panelwind brings the approach of <a href="https://github.com/shadcn-ui/lint">@shadcn/lint</a> to React Native and Expo, and adds what only a device can tell you.
</p>

<p align="center">
  <a href="./docs/README.md"><b>Documentation</b></a> ·
  <a href="#get-started">Get started</a> ·
  <a href="#rules">Rules</a> ·
  <a href="./docs/native.md">What React Native drops</a> ·
  <a href="./docs/adoption.md">Adoption</a>
</p>

---

**panelwind checks how a React Native app uses its design system.** It reads the
project's stylesheet, its components and their variants, and reports styling that
breaks the system — with an error that names the fix in terms of what the project
already has.

It works with any Expo project styled with Tailwind. A project set up with
[PanelUI](https://github.com/panel-ui/PanelUI) needs no configuration at all: its
`panelui.json` already says where the theme and the components are.

```text
"bg-destructive" is not allowed on <Button>: <Button> owns its color.
Use a variant: primary, secondary, destructive. Add a new variant in
src/components/ui/button.tsx only if the design calls for a treatment none of
them provides.
```

That message is the whole point. The variants in it were read out of your
component a moment ago, so whoever is reading — a developer or an agent — is
told what exists rather than that something is wrong.

## The rule a web linter cannot have

Tailwind generates CSS for every valid class. React Native applies a style object
to one view, and a lot of CSS has no way to become one. Those classes produce no
error, no warning, and no style:

```tsx
<View className="space-x-2 backdrop-blur-sm hover:bg-primary">
```

```text
"space-x-2" does nothing on a device: it is written as a rule about the elements
inside, and a native style applies to one view. Put the spacing on the children,
or use `gap-*` on this view.

"backdrop-blur-sm" does nothing on a device: React Native has no backdrop-filter.

"hover:bg-primary" does nothing on a device: a touch screen has no hover state.
Use `active:` for what happens under a finger.
```

This is answered by compiling the class with **your** Tailwind and **your**
stylesheet, then checking what it generated against the properties a React Native
style can actually carry — a table generated from React Native's own type
definitions, not written from memory. That matters more than it sounds:
`cursor-pointer` and `select-none` are **not** reported, because both properties
are real in React Native, and a hand-written table would have got them wrong.

See [what React Native drops](./docs/native.md).

## Get started

Needs Node 20.19+ and ESLint 9.30+.

```bash
npm install -D panelwind eslint
```

`eslint.config.mjs`:

```js
import panelwind from 'panelwind';

export default [
  ...panelwind.configs.recommended,
  {
    // A component styles its own parts; that is not restyling.
    files: ['src/components/ui/**'],
    rules: { 'panelwind/no-restyle': 'off' },
  },
];
```

```bash
npx eslint .
```

The preset configures the parser, so it works on a `.tsx` project with nothing
else set up. Then add the command to the file your agent reads:

```md
After making changes, run `npm run lint` and fix everything it reports.
```

Adding this to an app that already exists? Read
[adoption](./docs/adoption.md) first — the recommended preset errors on the three
findings the compiler can prove and warns on the four that are policy, which is
the order you want to fix them in.

## Rules

| Rule | What it reports | In `recommended` |
| --- | --- | --- |
| [`no-restyle`](./docs/rules/no-restyle.md) | A class on a component its contract does not allow. | warn |
| [`no-raw-colors`](./docs/rules/no-raw-colors.md) | A colour that is not a theme token. | warn |
| [`no-arbitrary-values`](./docs/rules/no-arbitrary-values.md) | A size that is not on the scale. | warn |
| [`no-inline-styles`](./docs/rules/no-inline-styles.md) | A static style object a class could express. | warn |
| [`require-static-classes`](./docs/rules/require-static-classes.md) | A class value the bundler never sees. | error |
| [`no-unknown-classes`](./docs/rules/no-unknown-classes.md) | A class that generates nothing. | error |
| [`no-web-only-classes`](./docs/rules/no-web-only-classes.md) | A class that generates CSS a device cannot apply. | error |

`configs.strict` is the same set with everything at `error`.

## You decide what a component owns

A policy is written in categories — `layout`, `color`, `typography`, `spacing`,
`shape`, `effects`, `motion` — and contracts attach one to the components a
pattern matches.

```js
'panelwind/no-restyle': ['error', {
  allow: ['layout'],
  contracts: [
    // A button is placed by the screen, and looks after the rest itself.
    { pattern: '^Button$', allow: ['layout', 'w-full', 'mt-*'] },
    // A card's title may change size, but not its font.
    { pattern: '^CardTitle$', allow: ['layout', 'typography'], deny: ['font-*'] },
  ],
}]
```

```tsx
<Button size="lg" className="mt-4 w-full" />   // allowed
<Button className="p-4 rounded-full" />        // reported: it owns its spacing and shape
<CardTitle className="text-lg" />              // allowed
<CardTitle className="font-bold" />            // reported: the contract denies font-*
```

None of this changes your components. The same component ships with different
rules in different projects.

## Write the error yourself

The message is what gets acted on, so your instruction belongs in it — with the
component's real variants and sizes filled in:

```js
'panelwind/no-restyle': ['error', {
  allow: ['layout'],
  message: {
    spacing: 'Use a {{component}} size: {{sizes}}. Never padding.',
  },
}]
```

```text
Use a Button size: sm, md, lg. Never padding.
```

A standing instruction for every rule goes in settings, where it is appended to
every diagnostic:

```js
settings: {
  panelwind: {
    ui: '@acme/ui',
    note: 'See DESIGN.md for the exceptions we have agreed.',
  },
}
```

See [shared options](./docs/rules.md) for every placeholder and setting.

## What it reads

| It reads | From |
| --- | --- |
| The CSS entry and the theme | `panelui.json`, or the stylesheet that imports Tailwind |
| Your components | The component directory and design-system packages, through imports |
| Their variants | `tv()` and `cva()` in the file that defines the component, slots included |
| Your tokens | `@theme` for the names, the light theme for the values |
| What a class does | Your Tailwind, compiling your stylesheet |

Nothing is executed, nothing is rendered, and no simulator is involved. See
[how it works](./docs/how-it-works.md).

## Documentation

- [How it works](./docs/how-it-works.md)
- [What React Native drops](./docs/native.md)
- [Shared options](./docs/rules.md)
- [Adding it to an app that already exists](./docs/adoption.md)
- [Troubleshooting](./docs/troubleshooting.md)

## License

[MIT](./LICENSE)
