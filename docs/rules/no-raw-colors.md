# no-raw-colors

Requires colour to come from the theme.

A native theme is compiled, not patched at runtime: every theme gets its own
copy of the values before the app ever starts. A colour written into a screen is
therefore the one colour it will ever be. It does not follow dark mode, and the
day the palette changes it stays behind.

```tsx
<View className="bg-zinc-500" />
<Icon color="#2563eb" />
```

```text
"bg-zinc-500" is not a theme colour. Use one from theme.css: background,
foreground, primary, card, muted, destructive, border (+8 more).

color is set to "#2563eb", which is the token "primary". Use it: a value
written here will not follow the theme.
```

Where the colour is written out, the message names the token nearest to it,
measured in OKLab so that "nearest" means what it looks like rather than what
its digits are.

## Where it looks

- Classes: `bg-zinc-500`, `text-[#111]`, `border-t-[rgb(0,0,0)]`.
- Style objects: `style={{ backgroundColor: '#fff' }}`.
- The props that take a colour rather than a style: `color`, `tintColor`,
  `placeholderTextColor`, `selectionColor`, `shadowColor`, and `fill` and
  `stroke` on vector elements.

Tailwind's own palette is not your theme. `bg-zinc-500` is a raw colour here
even though it is a perfectly valid class, which is the point of the rule.

## When you need the value, not the class

A colour that has to be passed to something that takes a value — a chart, a
vector, a native control — is read from the theme at runtime rather than typed
in:

```tsx
const tint = useCSSVariable('--color-primary');

<Icon color={tint} />
```

That follows the theme, so the rule has nothing to say about it.

## Options

```js
'panelwind/no-raw-colors': ['error', {
  allow: ['#00000000'],
  scanAllStrings: false,
  message: 'Use a theme colour from {{file}}.',
}]
```

- **`allow`** — values and classes to leave alone.
- **`scanAllStrings`** — also read every string literal in the file, which finds
  colours in lookup tables and constants. Off by default: it is a wider net and
  a noisier one.
- **`message`** — your words. `{{file}}`, `{{tokens}}`, `{{value}}`,
  `{{suggestion}}` and `{{property}}` are filled in.

## Where the tokens come from

The theme file named in `panelui.json`, or the CSS entry. Names come from
`@theme`; values come from the light theme, because a project with six themes
declares each token six times and only one set can be the one suggestions are
made from.
