# How it works

The linter reads your project — its config, its stylesheet, its components and
their variants — and checks how classes are used against what it finds. Nothing
is executed and nothing is rendered; it is all source.

## The project

Discovery starts at `panelui.json`, which already answers the questions that
matter: `css` names the stylesheet the bundler compiles, `theme` names the file
the tokens are declared in, and `aliases.components` names the directory copied
components are written to.

```json
{
  "aliases": { "components": "@/components/ui" },
  "css": "global.css",
  "theme": "theme.css"
}
```

Without that file the project root is the nearest `package.json`, the component
directory is `components/ui` or `src/components/ui`, and the CSS entry is the
stylesheet that imports Tailwind — where several qualify, the one that declares
the most tokens, then the one nearest the root.

## Components

A component is recognised through its import, not its name. Anything from the
component directory, from a design-system package, or from a prefix you name in
`settings.panelwind.ui` counts; a `Button` from somewhere else does not.

A local component that passes `className` through to one of them inherits its
contract, so an error about a colour on your `SaveButton` names the `Button`
whose contract it broke.

## Variants

Variants are read out of the file that defines the component — both shapes in
use: the flat one, where a variant maps to a string of classes, and the slot
one, where it maps to an object with an entry per part of the component. Props
typed as a union of strings count too.

This is why a package ships its source next to its build. The build has no
variants left to read; the source is where an error learns that a `Button` has
`primary`, `secondary` and `destructive`.

## Tokens

Token names come from `@theme`:

```css
@theme {
  --color-primary: unset;
  --radius-lg: 10px;
}
```

Values come from the light theme, written the way a native theme has to be —
one block per theme, with the values precomputed, because there is no runtime
that can evaluate a colour function on a device:

```css
:root {
  @variant light { --color-primary: #2563eb; }
  @variant dark  { --color-primary: #3b82f6; }
}
```

The web shape works too: `--color-primary: var(--primary)` with the value in
`:root`. Imports are followed, so a theme file a package ships contributes its
tokens — with one exception. Tailwind's own stylesheet is followed for imports
and contributes nothing: `bg-red-500` is a palette colour, not a decision your
project made.

## Classes, and one hop

Class text is read from `className` and the attributes like it, from the merge
and variant helpers — `cn`, `clsx`, `cva`, `tv` and the rest — and one hop
through a local variable:

```tsx
const tone = active ? 'bg-primary' : 'bg-muted';

<View className={tone} />
```

One hop is not a limitation picked for convenience: it is as far as the compiler
itself can see. Anything past it is recorded as unreadable, and
[require-static-classes](./rules/require-static-classes.md) reports it where it
matters, rather than it being quietly treated as empty.

## What a class does on a device

Two rules ask the project's own Tailwind to compile a class, and then read the
answer:

1. Nothing generated — [no-unknown-classes](./rules/no-unknown-classes.md).
2. Generated, but nothing that survives into a React Native style —
   [no-web-only-classes](./rules/no-web-only-classes.md).

It has to be the project's own CSS entry, because `ios:`, `native:` and the
safe-area utilities are declared in the stylesheet the styling library ships,
and a stock Tailwind would call every one of them a typo. See
[native.md](./native.md) for how the second question is answered.

Tailwind's loader is asynchronous and an ESLint rule is not, so that work
happens in a worker thread and the rule waits for it. If the worker ever stops
answering, it is said once and the two rules stand down for the rest of the run.

## What it cannot see

A clean result does not mean every styling path was checked.

- **Plain CSS.** Declarations in your stylesheet and anything `@apply` produces
  are outside these rules.
- **Values from another file.** Class text is followed within a file. A class
  built in a helper module is unreadable, and reported as unreadable.
- **A component rebuilt locally.** The token rules still apply, but `no-restyle`
  needs a component it can recognise.
- **New tokens.** A token added to `@theme` is allowed by design. That is the
  point of declaring it.

## Caching

Everything read from disk is cached against the file's modification time, so an
editor session picks up an edit to a component or a theme without a restart. The
compiled design system is cached per stylesheet and rebuilt when any file it was
built from changes.
