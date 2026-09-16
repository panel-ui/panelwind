/**
 * Whether a class does anything once it reaches a device.
 *
 * Three things can stop it, and they are checked separately because they need
 * different words in the error:
 *
 * 1. Its variant describes a state React Native does not have. `hover:` waits
 *    for a pointer that never arrives; `first:` describes a position in a list
 *    of siblings, which a native style has no way to ask about.
 * 2. Its rule styles something other than the element — `space-x-2` and
 *    `divide-y` are written as a rule about children, and a native style
 *    applies to one view.
 * 3. Its declarations name properties or values a React Native style cannot
 *    carry. `float-right` sets a property that does not exist there; `grid`
 *    sets a display React Native does not have.
 */
import table from './style-props.generated.json';

export type Verdict =
  | { kind: 'native' }
  | { kind: 'variant'; variant: string; reason: string }
  | { kind: 'selector'; reason: string }
  | { kind: 'properties'; properties: string[] }
  | { kind: 'values'; property: string; value: string; keywords: string[] }
  | { kind: 'empty' };

const PROPERTIES = new Set<string>([...table.properties, ...table.rewritten]);
const DROPPED = new Set<string>(table.dropped);
const KEYWORDS = table.keywords as Record<string, string[]>;

export const REACT_NATIVE_VERSION = table.reactNative;
export const UNIWIND_VERSION = table.uniwind;

/**
 * Variants with no native meaning, and what to say about each.
 *
 * Uniwind reads four things out of a selector — `:active`, `:focus`,
 * `:disabled` and `data-*` — plus the platform, width, orientation and colour
 * scheme of a media query. Everything below is outside that, so it is listed
 * rather than inferred: a list is wrong in a way somebody can correct, where a
 * guess at the general rule is wrong in a way nobody notices.
 */
const WEB_ONLY_VARIANTS: Record<string, string> = {
  hover: 'a touch screen has no hover state. Use `active:` for what happens under a finger.',
  'focus-visible': 'focus-visible follows keyboard navigation. Use `focus:`.',
  'focus-within': 'a native style applies to one view, so it cannot follow focus in a descendant.',
  first: 'position among siblings is not something a native style can ask about. Style the first item where you render it.',
  last: 'position among siblings is not something a native style can ask about. Style the last item where you render it.',
  odd: 'position among siblings is not something a native style can ask about. Decide it from the index where you render the row.',
  even: 'position among siblings is not something a native style can ask about. Decide it from the index where you render the row.',
  'only-child': 'position among siblings is not something a native style can ask about.',
  empty: 'there is no selector for an empty element. Decide it from the data.',
  target: 'there is no document to navigate within.',
  visited: 'there is no link history.',
  checked: 'checked is a form state of the DOM. Drive it from the prop that sets it, or use `data-[checked=true]:`.',
  indeterminate: 'form state of the DOM. Drive it from a prop.',
  required: 'form state of the DOM. Drive it from a prop.',
  valid: 'form state of the DOM. Drive it from a prop.',
  invalid: 'form state of the DOM. Drive it from a prop.',
  'placeholder-shown': 'form state of the DOM. Drive it from a prop.',
  autofill: 'there is no autofill state on a device.',
  'read-only': 'form state of the DOM. Drive it from a prop.',
  before: 'React Native has no generated content. Render the element.',
  after: 'React Native has no generated content. Render the element.',
  placeholder: 'style the placeholder with the component prop for it.',
  selection: 'there is no selection pseudo-element.',
  marker: 'there is no list marker.',
  backdrop: 'there is no backdrop pseudo-element.',
  file: 'there is no file input.',
  'motion-safe': 'the reduced-motion media query is not read on a device. Ask for the setting at runtime instead.',
  'motion-reduce': 'the reduced-motion media query is not read on a device. Ask for the setting at runtime instead.',
  print: 'there is nothing to print.',
  'contrast-more': 'the contrast media query is not read on a device.',
  'contrast-less': 'the contrast media query is not read on a device.',
  'forced-colors': 'forced colours are a desktop accessibility mode.',
  open: 'there is no `open` attribute to follow. Drive it from the prop that opens the thing.',
};

const WEB_ONLY_PREFIXES: Record<string, string> = {
  'group-': 'there is no selector that reaches from a parent to a child. Pass the state down as a prop.',
  'peer-': 'there is no selector that reaches between siblings. Pass the state down as a prop.',
  'has-': 'there is no selector that reaches into descendants.',
  'aria-': 'accessibility props are not attributes a style can match. Drive it from the prop, or use `data-[…]:`.',
  'supports-': 'there is no CSS feature detection on a device.',
  'pointer-': 'pointer capability is a browser media feature.',
  'any-pointer-': 'pointer capability is a browser media feature.',
};

export function variantVerdict(variants: string[]): Verdict {
  for (const variant of variants) {
    const name = variant.replace(/^(not-|max-|min-)/, '');
    const reason = WEB_ONLY_VARIANTS[name];
    if (reason) return { kind: 'variant', variant, reason };
    for (const [prefix, explanation] of Object.entries(WEB_ONLY_PREFIXES)) {
      // `group-[…]` and `peer-[…]` are the same thing with an arbitrary
      // selector in them, and no more reachable for it.
      if (name.startsWith(prefix)) return { kind: 'variant', variant, reason: explanation };
    }
  }
  return { kind: 'native' };
}

type Declaration = { property: string; value: string };
type Rule = { selector: string; declarations: Declaration[] };

/** What the project's Tailwind generated for a class, read back. */
export function declarationVerdict(css: string): Verdict {
  const rules = rulesOf(css);
  if (!rules.length) return { kind: 'empty' };

  const unsupported = new Set<string>();
  /** A property React Native has, given a value it does not take. */
  const unsupportedValues: { property: string; value: string }[] = [];
  let styledSomethingElse = false;

  for (const rule of rules) {
    if (!targetsTheElement(rule.selector)) {
      styledSomethingElse = true;
      continue;
    }
    for (const declaration of rule.declarations) {
      const property = camel(declaration.property);
      if (property.startsWith('--')) continue;
      if (lands(property, declaration.value)) return { kind: 'native' };
      // "React Native has no display" would be false: it has one, and this is
      // not a value it takes. The two are different sentences.
      if (PROPERTIES.has(property) && !DROPPED.has(property)) {
        unsupportedValues.push({ property: unprefixed(declaration.property), value: declaration.value.trim() });
      } else {
        // `-webkit-backdrop-filter` and `backdrop-filter` are one property
        // written twice; naming both reads as two things that are missing.
        unsupported.add(unprefixed(declaration.property));
      }
    }
  }

  if (unsupported.size) return { kind: 'properties', properties: [...unsupported] };
  if (unsupportedValues.length) {
    const first = unsupportedValues[0]!;
    return {
      kind: 'values',
      property: first.property,
      value: first.value,
      keywords: KEYWORDS[camel(first.property)] ?? [],
    };
  }
  if (styledSomethingElse) {
    return {
      kind: 'selector',
      reason:
        'it is written as a rule about the elements inside, and a native style applies to one view',
    };
  }
  return { kind: 'empty' };
}

function lands(property: string, value: string): boolean {
  if (DROPPED.has(property)) return false;
  if (!PROPERTIES.has(property)) return false;
  const keywords = KEYWORDS[property];
  if (!keywords) return true;
  const keyword = value.trim().replace(/!important$/, '').trim();
  // A value that is not a bare keyword — a length, a variable, a function —
  // is outside what a keyword list describes, and is left alone.
  if (!/^[a-z-]+$/i.test(keyword)) return true;
  return keywords.includes(keyword);
}

/**
 * The rule has to style the element the class is on, which Uniwind reads as
 * the first thing in the selector being that class.
 */
function targetsTheElement(selector: string): boolean {
  const first = selector.split(',')[0]!.trim();
  if (!first.startsWith('.')) return false;
  const rest = withoutBrackets(first.slice(1));
  return !/[\s>+~]/.test(rest);
}

/** Drops `:is(…)`, `:where(…)` and `[…]` so their insides are not read as structure. */
function withoutBrackets(selector: string): string {
  let out = '';
  let depth = 0;
  for (const character of selector) {
    if (character === '(' || character === '[') depth++;
    else if (character === ')' || character === ']') depth--;
    else if (depth === 0) out += character;
  }
  return out;
}

/** Selectors and declarations, with at-rule wrappers stepped through. */
function rulesOf(css: string): Rule[] {
  const rules: Rule[] = [];
  let buffer = '';
  const stack: string[] = [];

  for (let i = 0; i < css.length; i++) {
    const character = css[i];
    if (character === '{') {
      stack.push(buffer.trim());
      buffer = '';
      continue;
    }
    if (character === '}') {
      const prelude = stack.pop() ?? '';
      if (prelude && !prelude.startsWith('@')) {
        rules.push({ selector: unescape(prelude), declarations: declarationsOf(buffer) });
      }
      buffer = '';
      continue;
    }
    buffer += character;
  }
  return rules;
}

function declarationsOf(body: string): Declaration[] {
  const declarations: Declaration[] = [];
  for (const part of splitDeclarations(body)) {
    const colon = part.indexOf(':');
    if (colon === -1) continue;
    const property = part.slice(0, colon).trim();
    const value = part.slice(colon + 1).trim();
    if (property) declarations.push({ property, value });
  }
  return declarations;
}

function splitDeclarations(body: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let buffer = '';
  for (const character of body) {
    if (character === '(') depth++;
    else if (character === ')') depth--;
    if (character === ';' && depth === 0) {
      parts.push(buffer);
      buffer = '';
      continue;
    }
    buffer += character;
  }
  parts.push(buffer);
  return parts;
}

function unescape(selector: string): string {
  return selector.replace(/\\/g, '');
}

const VENDOR = /^-(webkit|moz|ms|o)-/;

function unprefixed(property: string): string {
  return property.startsWith('--') ? property : property.replace(VENDOR, '');
}

function camel(property: string): string {
  if (property.startsWith('--')) return property;
  return unprefixed(property).replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
}
