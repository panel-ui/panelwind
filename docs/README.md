# Documentation

Start with [Get started](../README.md#get-started) to set the plugin up.

## Guides

- [How it works](./how-it-works.md) — how the linter reads your project, and
  what it can and cannot see.
- [What React Native drops](./native.md) — how "does this class do anything on a
  device" is answered, and why the table it uses is generated.
- [Shared options](./rules.md) — categories, contracts, your own messages, and
  the settings every rule reads.
- [Adding it to an app that already exists](./adoption.md) — what to turn on
  first, and what to do with the first run's warnings.
- [Troubleshooting](./troubleshooting.md) — nothing reported, everything
  reported, and stale results.

## Rules

| Rule | What it reports |
| --- | --- |
| [no-restyle](./rules/no-restyle.md) | A class on a component its contract does not allow. |
| [no-raw-colors](./rules/no-raw-colors.md) | A colour that is not a theme token. |
| [no-arbitrary-values](./rules/no-arbitrary-values.md) | A size that is not on the scale. |
| [no-inline-styles](./rules/no-inline-styles.md) | A static style object a class could express. |
| [require-static-classes](./rules/require-static-classes.md) | A class value the bundler never sees. |
| [no-unknown-classes](./rules/no-unknown-classes.md) | A class that generates nothing. |
| [no-web-only-classes](./rules/no-web-only-classes.md) | A class that generates CSS a device cannot apply. |
