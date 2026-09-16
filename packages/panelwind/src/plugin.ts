/**
 * The plugin object. `meta.name` is the namespace, so every rule is written
 * the same way wherever it is configured: `panelwind/no-restyle`.
 */
import { noArbitraryValues } from './rules/no-arbitrary-values';
import { noInlineStyles } from './rules/no-inline-styles';
import { noRawColors } from './rules/no-raw-colors';
import { noRestyle } from './rules/no-restyle';
import { noUnknownClasses } from './rules/no-unknown-classes';
import { noWebOnlyClasses } from './rules/no-web-only-classes';
import { requireStaticClasses } from './rules/require-static-classes';

export const rules = {
  'no-restyle': noRestyle,
  'no-raw-colors': noRawColors,
  'no-arbitrary-values': noArbitraryValues,
  'no-inline-styles': noInlineStyles,
  'require-static-classes': requireStaticClasses,
  'no-unknown-classes': noUnknownClasses,
  'no-web-only-classes': noWebOnlyClasses,
};

export const plugin = {
  meta: { name: 'panelwind' },
  rules,
};
