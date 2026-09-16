# Troubleshooting

## Nothing is reported at all

The rules that need the project's stylesheet stand down when they cannot find
one, and say so once:

```text
panelwind: no CSS entry was found for /path/to/app; no-unknown-classes is
standing down. Name one in panelui.json.
```

Name it:

```json
{ "css": "global.css", "theme": "theme.css" }
```

`no-restyle` is quieter about it: with no components to recognise it simply has
nothing to say. Check that your imports match — `settings.panelwind.ui` takes
the prefix you import components by.

## Every class is reported as unknown

The oracle is compiling a different stylesheet from the one your bundler
compiles. The entry has to be the file that imports Tailwind **and** your
styling library, because that is where the platform variants and the safe-area
utilities come from:

```css
@import 'tailwindcss';
@import 'uniwind';
@import './theme.css';
```

If `ios:flex` is reported as unknown, that second import is missing from the
file the linter found.

## A class I know exists is reported as unknown

Ask Tailwind the same question directly:

```bash
npx eslint path/to/file.tsx --rule '{"panelwind/no-unknown-classes":"error"}'
```

Then check the class is generated at all: a utility that comes from a plugin
needs the plugin to be loadable from the stylesheet, and a token has to be
declared in `@theme` before `bg-<token>` exists.

## My theme's colours are not suggested

Values are read from the **light** theme. A project whose values live only in a
`dark` block still has its token *names* — so classes are checked — but nothing
to measure a raw colour against, so no token is named in the message.

## Results did not change after an edit

Everything is cached against file modification times, so an edit to a component
or a theme is picked up on the next run. Two things are not: a change to
`panelui.json`, and a change to the plugin's own configuration. Restart the
editor's ESLint server after either.

## A rule is slow on the first file

The first class question of a run loads Tailwind and compiles the stylesheet,
which takes a moment. Every question after that is answered from cache. If it
takes more than twenty seconds the oracle gives up, says so once, and the two
class rules stand down for the rest of the run.

## `no-restyle` says a class is not recognised

```text
"flex-row" is not allowed on <Card.Content>: it is not a class the grammar
recognises.
```

That is a gap in the grammar, not a problem with your code. Please open an issue
with the class name — and in the meantime `allow` it, or run
`node scripts/classes.mjs src` to see everything else in the same position.
