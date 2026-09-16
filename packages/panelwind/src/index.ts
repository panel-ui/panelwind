/**
 * panelwind — what the linter knows about a project, and (once the rules are
 * wired in) the ESLint plugin itself.
 *
 * The project model is exported because the same answers are useful to other
 * tooling: which components a project has, what its tokens are, and what a
 * class does on a device. Experimental until 1.0.
 */
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

export { plugin, rules } from './plugin';

export const project = {
  projectFor,
  themeFor,
  componentsFor,
  variantDefinitionsOf,
  variantNamesFor,
  sizeNamesFor,
};

export const native = {
  cssFor,
  classListFor,
  declarationVerdict,
  variantVerdict,
  reactNative: REACT_NATIVE_VERSION,
  uniwind: UNIWIND_VERSION,
};

export default plugin;
