/**
 * The plugin object. `meta.name` is the namespace, so every rule is written
 * the same way wherever it is configured: `panelwind/no-restyle`.
 */
import { noRestyle } from './rules/no-restyle';
import { noUnknownClasses } from './rules/no-unknown-classes';
import { noWebOnlyClasses } from './rules/no-web-only-classes';

export const rules = {
  'no-restyle': noRestyle,
  'no-unknown-classes': noUnknownClasses,
  'no-web-only-classes': noWebOnlyClasses,
};

export const plugin = {
  meta: { name: 'panelwind' },
  rules,
};
