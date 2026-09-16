# Adding it to an app that already exists

The three rules the compiler can prove are safe to turn on at `error` on day
one. An app that was working will have few of them, and each one is a real
defect: a class that generates nothing, a class React Native drops, a class the
bundler never sees.

The four policy rules are different. An app written before there was a policy
has hundreds of findings, and a first run that prints hundreds of errors gets
the plugin removed rather than the classes.

## Start where the preset starts

`configs.recommended` errors on the provable three and warns on the rest. Run it
and read the warnings before deciding anything:

```bash
npx eslint . --quiet   # errors only
npx eslint .           # everything
```

## Then decide what your components own

Most of the `no-restyle` warnings on an existing app are spacing and width on a
component — `mt-4` on a button, `p-2` on a card's content. Two ways to answer
them, and both are legitimate:

**Open the component up.** If the screen is the right place to decide the room
around a button, say so:

```js
'panelwind/no-restyle': ['error', {
  allow: ['layout'],
  contracts: [
    { pattern: '^Button$', allow: ['layout', 'm-*', 'mt-*', 'mb-*', 'w-full'] },
  ],
}]
```

**Move the class out.** Room around a component is nearly always the parent's
`gap-*`, and a row of buttons wants one `gap` rather than a margin on each.

## Take the directory the components live in out of scope

A component styles its own parts, and where one is built out of another
`no-restyle` has nothing useful to say:

```js
{
  files: ['src/components/ui/**'],
  rules: { 'panelwind/no-restyle': 'off' },
}
```

## Tell the agent to run it

The errors are written to be acted on, and that only happens if something reads
them. Put the command in the file your agent reads:

```md
After making changes, run `npm run lint` and fix everything it reports.
```

## Raise the level when the count is zero

A warning nobody clears is noise. When a rule reaches zero, move it to `error`
so it stays there — or switch the whole set on with `configs.strict`.
