# no-web-only-classes

Reports classes that compile and then do nothing on a device.

Tailwind generates CSS for every valid class. React Native applies a style
object to one view, and a great deal of CSS has no way to become one: there is
no `float`, no `display: grid`, no way for a rule to reach a child, and no
pointer to hover. Those classes produce no error and no warning. The layout is
simply not the one the class describes, and the class stays in the file looking
like it works.

```tsx
<View className="space-x-2">
```

```text
"space-x-2" does nothing on a device: it is written as a rule about the
elements inside, and a native style applies to one view. Put the spacing on
the children, or use `gap-*` on this view.
```

## What it catches

| Written | Why nothing happens |
| --- | --- |
| `space-x-2`, `divide-y` | The rule targets the children, not the element. |
| `float-right`, `clear-both` | React Native has no such property. |
| `grid`, `block`, `inline` | Its `display` only takes `flex`, `none` and `contents`. |
| `backdrop-blur-sm` | The property is dropped in the conversion to a native style. |
| `hover:bg-primary` | A touch screen has no hover state. |
| `group-hover:*`, `peer-*`, `has-*` | No selector reaches between elements. |
| `first:`, `last:`, `odd:`, `even:` | A style cannot ask where an element sits among its siblings. |
| `motion-reduce:`, `print:`, `contrast-more:` | Those media queries are not read on a device. |

Each gets its own sentence, because the fix is different every time: a sibling
position is decided from the index where the row is rendered, a hover state
becomes `active:`, and a rule about children becomes `gap-*`.

## What it does not catch

`cursor-pointer` and `select-none` are **not** reported. Both properties are in
React Native's own style types, and a table written from memory would have said
otherwise — this one is generated from the types the installed version ships.
See [native.md](../native.md).

## Where it stands down

- A file named `*.web.tsx` is a browser file.
- A class written `web:hover:bg-primary` says the browser is what it is for.
- Anything listed in `allow`.

```js
'panelwind/no-web-only-classes': ['error', { allow: ['sr-only'] }]
```

## What it needs

The project's CSS entry, which is where the variants and utilities come from. It
is read from `panelui.json`, or found by looking for the stylesheet that imports
Tailwind. Without one the rule says so once and stands down for the run rather
than guessing.
