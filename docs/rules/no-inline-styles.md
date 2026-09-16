# no-inline-styles

Reports a style object whose every value is a literal — a class written the long
way round.

This rule is narrower than the web rule of the same name, and has to be. React
Native needs `style`. An animated style is an object because it is a value that
changes on the UI thread; a measured height is a number nobody can write as a
class. Neither is reported.

What is reported is the style that could have been a class:

```tsx
<View style={{ padding: 12, backgroundColor: '#fff' }} />
```

```text
This style sets padding and backgroundColor, which a class can express. Put it
in className: a style object is outside the theme, so nothing checks it and
nothing follows a theme change.
```

The cost is not the two lines of source. It is that a style object is invisible
to everything else here — no token rule, no contract, no theme.

## What is left alone

```tsx
// A value that changes on the UI thread.
<Animated.View style={animatedStyle} />
<Animated.View style={{ opacity: progress.value }} />

// A value that is measured, not chosen.
<View style={{ height: measured }} />

// transform, shadowOffset and elevation, which are always computed.
<View style={{ transform: [{ scale }] }} />
```

Anything the linter cannot read is treated as a value that changes, because that
is what `style` is for.

## StyleSheet.create

A stylesheet is the same thing with a name, so it is reported too:

```text
StyleSheet.create sets flexDirection and gap in "row", which classes can
express. A stylesheet is outside the theme, so nothing checks it and nothing
follows a theme change.
```

Turn that half off with `stylesheets: false` if a project keeps a deliberate
sheet.

## Options

```js
'panelwind/no-inline-styles': ['warn', {
  allow: ['width', 'height'],
  stylesheets: true,
  message: 'Use className; style is for values that change.',
}]
```

- **`allow`** — property names to leave alone.
- **`stylesheets`** — whether `StyleSheet.create` is reported. Default `true`.
