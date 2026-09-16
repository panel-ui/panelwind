# Changelog

## [0.1.0] — 2026-09-16

The first release. Seven rules, an ESLint 9 flat-config plugin, and two presets.

### Added

- **`no-restyle`** — a design-system component's `className` carries what its
  contract allows, and its appearance comes from its variants. Findings name the
  variants that exist, read out of the component's source, and spacing findings
  name its sizes. A local component that passes `className` through is reported
  as the component it wraps.
- **`no-web-only-classes`** — classes that compile and then do nothing on a
  device: `space-x-2` and `divide-y`, which style children; `float-right` and
  `grid`, which name properties and values React Native does not have;
  `backdrop-blur-sm`, which is dropped in the conversion; and the variants that
  describe states a device has no way to be in, from `hover:` to `first:`.
- **`no-unknown-classes`** — classes the project's own Tailwind generates
  nothing for, with the nearest real class named. A broken variant is reported
  as a broken variant rather than as an unknown class.
- **`no-raw-colors`** — colours that are not theme tokens, in classes, in style
  objects and in the props that take a colour. Where the value is written out,
  the nearest token is named, measured in OKLab.
- **`no-arbitrary-values`** — sizes that are not on the scale, with the matching
  step named where the theme has one, and a note about the failure specific to
  this platform: a value added while the bundler is running compiles to nothing
  until it restarts.
- **`no-inline-styles`** — static style objects a class could express.
  Deliberately narrow: an animated or measured value is what `style` is for and
  is never reported.
- **`require-static-classes`** — class values the bundler never sees, which on a
  device produce no style at all.
- **`configs.recommended`** and **`configs.strict`**. The first errors on the
  three findings the compiler can prove and warns on the four that are policy,
  so an app that already exists can adopt it without a wall of red. Both
  configure the parser.
- **Contracts and your own messages.** A policy attaches to the components a
  pattern matches, and every rule's wording can be replaced — with the
  component's real variants, sizes and tokens interpolated into it.
- **Zero-configuration discovery** for projects with a `panelui.json`, which
  already names the CSS entry, the theme and the component directory.

### Notes

What a class does on a device is not guessed. Classes are compiled by the
project's own Tailwind against the project's own stylesheet, and the result is
checked against a table generated from React Native's own type definitions.
`cursor-pointer` and `select-none` are therefore **not** reported: both
properties are real in React Native, where a table written from memory would
have said otherwise.
