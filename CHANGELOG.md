# Changelog

## [0.2.0] — 2026-09-17

An external review of 0.1.0, verified case by case. Six of the reported
problems reproduced and are fixed; two defaults changed, both of which change
what an existing config reports.

### Fixed

- **`require-static-classes` no longer refuses a template whose classes are all
  written out.** `` className={`p-2 ${lg ? 'p-4' : 'p-2'}`} `` was reported,
  because the empty quasi at the end of the template was read as the second
  half of a class the expression began. Nothing was written there to be half of
  a class. An empty quasi *between* two expressions still joins both.
- **A lookup table is read instead of refused.** `TONE[k]`, where `TONE` is an
  object in the same file, is the fix the rule's own page recommends, and it
  was reported as a value the bundler cannot see. Every value in the table is
  read, and they stay visible to the other rules — a broken class in a table is
  still reported wherever the table is used. `as const`, `satisfies` and `!` are
  unwrapped on the way. A lookup on an object the file does not declare is still
  refused.
- **`props.className` is treated as the prop it is.** The destructured
  `{ className }` was left alone and `props.className` was reported, though both
  are answered for where the caller wrote them. Every prop the collector counts
  as a class attribute is covered, not only the literal name `className`.
- **An arbitrary colour is reported once.** `text-[#ff0000]` came back from
  `no-raw-colors` and from `no-arbitrary-values`. The first names the token the
  colour is nearest to, so it is the one kept.
- **A property is named once, without its vendor prefix.** `backdrop-blur-sm`
  was refused with "React Native has no -webkit-backdrop-filter and
  backdrop-filter", which reads as two missing properties rather than one
  written twice.
- **An answer from the oracle is checked against the question.** After a
  question timed out, its answer stayed in the port and the next question read
  it as its own. A mismatched id is now a transport failure.
- **Answers about a stylesheet that has changed are let go.** They were cached
  per file and modification time and never dropped, so an editor session
  accumulated a set for every version of a theme it had ever seen.

### Changed

- **`require-static-classes` checks every element, not only design-system
  components.** A class the bundler never sees produces no style wherever it is
  written, and `` className={`p-${size}`} `` on a plain `View` is where that is
  written most often. Over 22 files of a real Expo app the count went from 10
  findings to 12, both of them real. *Migration:* `everywhere: false` restores
  the old scope.
- **Margin is `layout`, not `spacing`.** `mt-4` on a `<Button>` was refused
  under `allow: ['layout']`, the allowance most projects start from — and the
  README's own contract example assumes it is permitted. Room around a
  component is a decision about where it sits, and the component cannot make
  it; padding stays `spacing`, because that is the size of the thing.
  *Migration:* a project that wants margin refused again adds `deny: ['m-*',
  'mx-*', 'my-*', 'mt-*', 'mr-*', 'mb-*', 'ml-*']` to `no-restyle`.

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
