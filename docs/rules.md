# Shared options

Every rule takes the options on this page. The per-rule pages cover what is
specific to each.

## Categories

A class belongs to one category, and a policy is written in terms of them.

| Category | Classes | Who usually owns it |
| --- | --- | --- |
| `layout` | `flex-1`, `w-full`, `items-center`, `absolute`, `text-center` | The screen placing the component |
| `spacing` | `p-4`, `mt-2`, `gap-2` | The component, for its own padding |
| `color` | `bg-primary`, `text-foreground`, `border-border` | The component |
| `typography` | `text-sm`, `font-medium`, `leading-5` | The component |
| `shape` | `rounded-lg`, `border-2` | The component |
| `effects` | `opacity-60`, `shadow-sm`, `blur-sm` | The component |
| `motion` | `transition`, `duration-200`, `animate-spin` | The component |

`allow: ['layout']` is where most projects start: where a component sits and how
big its box is belongs to whatever is placing it; how it looks belongs to it.

Tailwind overloads several utilities, and the project's own tokens are what
separate them — `text-sm` is typography, `text-primary` is colour because
`primary` is a declared token, and `text-center` is layout.

A class the grammar does not recognise is `unclassified`, and `allow: ['layout']`
does not cover it. If you see that verdict for a class you know is real, it is
a gap in the grammar — please open an issue with the class name.

## allow and deny

Both take categories and class patterns, and a pattern may end in `*`:

```js
allow: ['layout', 'w-full', 'mt-*']
```

`deny` is checked first, so it wins over `allow`.

## Contracts

A contract attaches a policy to the components whose name matches a regular
expression:

```js
contracts: [
  { pattern: '^Button$', allow: ['layout', 'w-full'] },
  { pattern: '^Card\\.', allow: ['layout', 'spacing'] },
]
```

The first matching contract is the one that applies. A contract's `allow`
**replaces** the rule's rather than adding to it, which is what makes
`allow: []` — a component nothing may be added to — possible.

Names are matched as they are written in the JSX, so a compound component is
`Card.Header`, and `^Card\.` matches all of its parts.

## Your own words

`message` replaces the rule's wording. A diagnostic is what an agent acts on, so
a project's own instruction belongs in it:

```js
'panelwind/no-restyle': ['error', {
  allow: ['layout'],
  message: {
    spacing: 'Use a {{component}} size: {{sizes}}. Never padding.',
    color: 'Colours come from the variants. Ask design before adding one.',
  },
}]
```

One string applies to every finding; an object applies per category, with
`default` as the fallback.

These are filled in where the rule has them: `{{className}}`, `{{component}}`,
`{{wrapper}}`, `{{category}}`, `{{variants}}`, `{{sizes}}`, `{{entries}}`,
`{{tokens}}`, `{{suggestion}}`, `{{value}}`, `{{property}}`, `{{file}}`.

## Recognition

Which imports name a design-system component, and which helpers hold classes.
Set them once in `settings.panelwind`, or on a rule to override them there.

| Option | What it does |
| --- | --- |
| `ui` | An import prefix: `@/ds` matches `@/ds` and `@/ds/button`, but not `@/dsx`. |
| `componentImports` | Regular expressions matched against the import source. |
| `ignoreImports` | Regular expressions that stop an import being recognised. Wins over the two above. |
| `mergeFunctions` | Helpers whose arguments hold classes, beyond `cn`, `cx`, `clsx`, `classNames`, `twMerge` and `twJoin`. |
| `variantFunctions` | Helpers whose object *values* hold classes, beyond `tv` and `cva`. |
| `note` | Appended to every diagnostic from every rule. |

```js
settings: {
  panelwind: {
    ui: '@acme/ui',
    mergeFunctions: ['styles'],
    note: 'See DESIGN.md for the exceptions we have agreed.',
  },
}
```

`note` is the shortest way to put a project's standing instruction in front of
whoever — or whatever — is reading the error.
