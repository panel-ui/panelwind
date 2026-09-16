# What React Native drops

Tailwind describes CSS. A device applies a style object to one view. Between the
two, some of what a class generates survives and some of it does not — and the
part that does not disappears silently, which is why
[no-web-only-classes](./rules/no-web-only-classes.md) exists.

This page is how that question is answered.

## The question is asked three times

**Does the variant describe a state that exists?** `active:`, `focus:`,
`disabled:`, `data-[…]:`, the platform variants, the breakpoints, the
orientation and the colour scheme all reach the device. `hover:` does not: there
is no pointer. `first:` and `odd:` do not: a native style has no way to ask
where a view sits among its siblings. `group-*`, `peer-*` and `has-*` do not:
nothing reaches between elements.

**Does the rule style the element?** A style applies to one view, so a rule
written about the children — `space-x-2`, `divide-y` — has nowhere to land.

**Do any of its declarations survive?** Each property the class generates is
checked against the properties a React Native style can carry, and each keyword
value against the values that property accepts. `float` is not a property;
`display: grid` is not a value.

## The table is generated, not written

The list of properties, and the keywords each one accepts, is generated from the
React Native type definitions installed in this repository —
`ViewStyle`, `TextStyle`, `ImageStyle` and the interfaces they extend. The
conversion's own two dropped properties are read from the styling library's
converter.

```bash
npm run native:generate --workspace=panelwind
```

CI regenerates it and fails if the result differs from what is committed, so a
React Native upgrade that adds a property cannot leave the rule behind.

It is generated for a reason. **`cursor` and `userSelect` are both real React
Native style properties**, so `cursor-pointer` and `select-none` are not
reported — and a table written from memory would have reported both, because
they read like browser-only classes. The measurement was right and the intuition
was wrong.

## What this cannot tell you

That a class produces a style is not a promise that the style does anything
useful. `line-clamp-2` sets `overflow: hidden`, which is real, along with three
properties that are not — clipping text to a number of lines is what the
`numberOfLines` prop is for. The rule stays quiet where something lands, because
a linter that reports working code is one people turn off.

## Versions

The committed table records which versions it was generated from, and the plugin
exposes them:

```js
import { native } from 'panelwind';

native.reactNative; // the version the property list came from
native.uniwind;     // the version the conversion was read from
```
