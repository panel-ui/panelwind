/**
 * panelwind — the plugin, its presets, and a window onto what it knows.
 *
 * The project model is exported because the same answers are useful outside a
 * lint run: which components a project has, what its tokens are, and what a
 * class does once it reaches a device. Experimental until 1.0.
 */
import { configs } from './configs';
import { classify, CATEGORIES } from './grammar/categories';
import { parseClass, splitClasses } from './grammar/classes';
import { plugin } from './plugin';
import { componentsFor } from './project/components';
import { projectFor } from './project/config';
import { themeFor } from './project/theme';
import { variantDefinitionsOf, variantNamesFor, sizeNamesFor } from './project/variants';
import { classListFor, cssFor } from './native/client';
import {
  declarationVerdict,
  variantVerdict,
  REACT_NATIVE_VERSION,
  UNIWIND_VERSION,
} from './native/support';

/**
 * One object, whether it is reached by name or as the default: the presets
 * name the plugin, so the two have to be the same plugin.
 */
const panelwind = Object.assign(plugin, { configs });

export { rules } from './plugin';
export { configs } from './configs';
export { panelwind as plugin };

export const project = {
  projectFor,
  themeFor,
  componentsFor,
  variantDefinitionsOf,
  variantNamesFor,
  sizeNamesFor,
};

/** How a class is read: what kind of change it makes, and its parts. */
export const grammar = {
  classify,
  categories: CATEGORIES,
  parseClass,
  splitClasses,
};

export const native = {
  cssFor,
  classListFor,
  declarationVerdict,
  variantVerdict,
  reactNative: REACT_NATIVE_VERSION,
  uniwind: UNIWIND_VERSION,
};

export type Category =
  | 'layout'
  | 'color'
  | 'typography'
  | 'spacing'
  | 'shape'
  | 'effects'
  | 'motion';

/** What a rule's `message` can be: one string, or one per category. */
export type RuleMessage = string | Partial<Record<Category | 'default', string>>;

export type Contract = {
  /** A regular expression matched against the component's name. */
  pattern: string;
  allow?: string[];
  deny?: string[];
  message?: RuleMessage;
};

export type Recognition = {
  ui?: string | string[];
  componentImports?: string[];
  ignoreImports?: string[];
  mergeFunctions?: string[];
  variantFunctions?: string[];
};

export type RestyleOptions = Recognition & {
  allow?: string[];
  deny?: string[];
  contracts?: Contract[];
  message?: RuleMessage;
};

export type TokenOptions = Recognition & {
  allow?: string[];
  message?: string;
  scanAllStrings?: boolean;
};

export default panelwind;
