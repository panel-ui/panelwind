# require-static-classes

Requires class values the bundler can see.

Classes are compiled from the text in your source. A class assembled at runtime
is never in that text, so no CSS is generated for it and the style does not
exist. On the web this degrades — the element is unstyled but present. Here the
property never arrives, which reads as a component ignoring its prop.

```tsx
<Button className={`bg-${tone}`} />
```

```text
This class value on <Button> cannot be read, so the bundler never sees the
class and no style is generated for it. Write the whole class in each branch —
`tone === "danger" ? "bg-destructive" : "bg-primary"`.
```

The fix is always the same shape: every class that can render has to appear
somewhere as whole text.

```tsx
<Button className={tone === 'danger' ? 'bg-destructive' : 'bg-primary'} />
```

A lookup works too, as long as the values are written out:

```tsx
const TONE = { danger: 'bg-destructive', calm: 'bg-primary' } as const;

<Button className={TONE[tone]} />
```

## What is not reported

A `className` a component was handed is answered for where it was written:

```tsx
export function Save({ className }) {
  return <Button className={className} />;
}
```

The same prop read off the props object — `props.className` — is left alone for
the same reason.

The `TONE` lookup near the top of this page is read rather than refused: a
table can only produce one of the values written in it, so those are what is
checked, and the key it is indexed by does not matter. A table declared in
another file is a different case — the bundler's scanner cannot see that one
either, so it is still reported.

## Every element, not only components

Every element is checked. A class the bundler never sees produces no style
wherever it is written, and a plain `View` is where that is written most often.

```js
'panelwind/require-static-classes': ['error', { everywhere: false }]
```

That narrows the rule to design-system components, which is what it did before
0.2.0.

## Options

```js
'panelwind/require-static-classes': ['error', {
  everywhere: true,
  message: 'Write the whole class in each branch.',
}]
```

## Why this is an error rather than a warning

It is the one finding here that is never a matter of taste. The style does not
exist at runtime, whatever the design system says about it.
