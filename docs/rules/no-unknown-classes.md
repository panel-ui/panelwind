# no-unknown-classes

Reports a class the project's Tailwind generates nothing for.

A misspelled class is not an error anywhere. The bundler skips it, the style
never arrives, and the element keeps whatever its parent gave it — which on a
phone usually looks like a layout that is nearly right.

```tsx
<View className="rounded-huge" />
```

```text
"rounded-huge" generates no CSS in this project, so nothing of it reaches the
device. Did you mean "rounded-lg"?
```

The suggestion comes from the list of classes this project can generate, so it
includes the utilities your theme adds and the ones it does not.

## A broken variant is reported as one

```tsx
<View className="hovr:flex" />
```

```text
"hovr:flex" generates no CSS in this project: "hovr" is not a variant it
declares. The platform variants are ios, android, native, web and tv.
```

`flex` is a working class with a broken prefix, and saying which half is wrong
is most of the fix.

## An undeclared token

```tsx
<View className="bg-highlight" />
```

```text
"bg-highlight" generates no CSS in this project, so nothing of it reaches the
device. Use a class the theme defines, or add it to theme.css.
```

A colour has to be declared before it can be used. This is the rule that says
so; [no-raw-colors](./no-raw-colors.md) is the one about using a colour that was
never a token at all.

## Options

```js
'panelwind/no-unknown-classes': ['error', {
  allow: ['my-legacy-class'],
  message: 'Use a class from the design system.',
}]
```

## What it needs

The project's own Tailwind and the project's own CSS entry. Both matter: the
variants `ios:`, `android:` and `native:` and the safe-area utilities are
declared in the stylesheet the styling library ships, and a linter compiling
against a stock Tailwind would report every one of them as a typo.
