# no-arbitrary-values

Requires sizes to come from the scale.

There are two reasons here, and the second is the one that costs an afternoon.

The first is the ordinary one: a scale exists so that sizes in a product are
related to each other, and `p-[13px]` is outside it.

The second belongs to this platform. An arbitrary value has to be compiled, and
the bundler only ever sees the class text that existed when it started. A value
added to a file while the dev server is running generates no CSS at all — no
error, no warning, the property simply never arrives — until the server is
restarted. A step of the scale was compiled long ago and works immediately.

```tsx
<View className="h-[330px] rounded-[10px]" />
```

```text
"h-[330px]" is an arbitrary value. Use a step of the scale in theme.css — and
note that a value added while the bundler is running compiles to nothing until
it is restarted.

"rounded-[10px]" is an arbitrary value, and "rounded-lg" is the same size. Use
it: a value added while the bundler is running compiles to nothing until it is
restarted.
```

Where the theme has a step of exactly that size, the message names it.

## A property written as a class

```tsx
<View className="[padding:12px]" />
```

```text
"[padding:12px]" sets a property directly. Use a utility, or add a token to
theme.css if the design needs one.
```

## Options

```js
'panelwind/no-arbitrary-values': ['warn', {
  allow: ['h-[330px]'],
  message: 'Use a step of the spacing scale.',
}]
```

## When an arbitrary value is right

Some measurements are not design decisions: a height that matches a video's
aspect ratio, a width taken from a device dimension. Put those in `allow`, or
turn the rule off for the file — and if a value appears in several places, it is
a token that has not been declared yet.

## What it does not do

It does not report arbitrary values inside your design system's own components,
unless you lint that directory with the rule on. A component is where a
considered exception belongs.
