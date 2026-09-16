# no-restyle

Controls what a design-system component's `className` may carry.

A component owns its appearance: its colours, its type, its shape, its internal
spacing. A screen that changes those from the outside has made a second version
of the component that nothing else knows about. This rule refuses the change and
names what to use instead — the component's own variants, or a size.

```tsx
<Button className="bg-destructive">Delete</Button>
```

```text
"bg-destructive" is not allowed on <Button>: <Button> owns its color.
Use a variant: primary, secondary, destructive. Add a new variant in
src/components/ui/button.tsx only if the design calls for a treatment none of
them provides.
```

The variants in that message are read out of the component's source, so the
suggestion is always the set that exists today.

## Options

```js
'panelwind/no-restyle': ['error', {
  allow: ['layout'],
  deny: [],
  contracts: [
    { pattern: '^Button$', allow: ['layout', 'w-full', 'mt-*'] },
  ],
  message: { spacing: 'Use a size, not padding.' },
}]
```

- **`allow`** — categories and class patterns every component accepts. `layout`
  is the usual starting point: where a component sits and how big its box is
  belongs to the screen placing it.
- **`deny`** — refused even when `allow` would have permitted it. Checked first.
- **`contracts`** — a policy for the components whose name matches `pattern`.
  A contract's `allow` **replaces** the rule's, so repeat `layout` to keep it;
  that is also how a component is closed completely, with `allow: []`.
- **`message`** — your words instead of the rule's, either one string or one per
  category. See [rules.md](../rules.md#your-own-words).

The categories are `layout`, `color`, `typography`, `spacing`, `shape`,
`effects` and `motion`.

## What counts as a component

Anything imported from your UI directory or from a design-system package —
recognised through the import, not the name, so a `Button` from somewhere else
is not affected. A local component that passes `className` through to one is
treated as the component it wraps:

```tsx
function SaveButton({ className, ...props }) {
  return <Button className={cn('w-full', className)} {...props} />;
}

<SaveButton className="bg-destructive" />
```

```text
"bg-destructive" is not allowed on <SaveButton>: <SaveButton> passes className
to <Button>, which owns its color. Use a variant: primary, secondary, destructive.
```

## Turn it off inside the design system

A component file styles its own parts, and where one component is built out of
another the rule has nothing useful to say. Add an override for the directory
they live in:

```js
{
  files: ['src/components/ui/**'],
  rules: { 'panelwind/no-restyle': 'off' },
}
```

## Spacing is answered with sizes

Padding on a control is nearly always a size, and room around it belongs to
whatever is placing it — so a spacing finding offers both:

```text
"p-6" is not allowed on <Button>: <Button> owns its spacing.
Use a size (sm, md, lg), or gap on the view around it for room around it.
```

Where the component has no size axis, only the second half is offered.

## Adopting it on an existing app

Most apps put spacing and width on components, and turning this rule on at
`error` across one produces a long list on the first run. Start it as a warning,
then either open the components up with contracts or move the classes out. See
[adoption](../adoption.md).
