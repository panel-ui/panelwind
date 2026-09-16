/**
 * What kind of change a class makes.
 *
 * A contract is written in these terms — "this component owns its colour and
 * its spacing, the page owns its layout" — so the classifier is what decides
 * whether a class is refused. The hard cases are the utilities Tailwind
 * overloads: `text-sm` sizes type, `text-primary` paints it and `text-center`
 * arranges it, and the only way to tell them apart is to know which values are
 * colours in this project.
 */
import { arbitraryValue, isArbitrary, parseClass, utilityName } from './classes';

export const APPEARANCE = ['color', 'typography', 'spacing', 'shape', 'effects', 'motion'] as const;

export type Category = (typeof APPEARANCE)[number] | 'layout' | 'unclassified';

export const CATEGORIES: Category[] = [...APPEARANCE, 'layout'];

export type Vocabulary = {
  /** The project's declared colour tokens: `primary`, `card-foreground`. */
  colors: Set<string>;
  /** The steps of its text scale, when it declares one. */
  textSizes: Set<string>;
};

export const NO_VOCABULARY: Vocabulary = { colors: new Set(), textSizes: new Set() };

const EXACT: Record<string, Category> = {
  flex: 'layout',
  grid: 'layout',
  contents: 'layout',
  hidden: 'layout',
  block: 'layout',
  inline: 'layout',
  'inline-flex': 'layout',
  'inline-block': 'layout',
  'inline-grid': 'layout',
  table: 'layout',
  'flow-root': 'layout',
  isolate: 'layout',
  absolute: 'layout',
  relative: 'layout',
  fixed: 'layout',
  sticky: 'layout',
  static: 'layout',
  container: 'layout',
  truncate: 'typography',
  italic: 'typography',
  'not-italic': 'typography',
  uppercase: 'typography',
  lowercase: 'typography',
  capitalize: 'typography',
  'normal-case': 'typography',
  underline: 'typography',
  overline: 'typography',
  'line-through': 'typography',
  'no-underline': 'typography',
  antialiased: 'typography',
  'subpixel-antialiased': 'typography',
  border: 'shape',
  rounded: 'shape',
  ring: 'shape',
  outline: 'shape',
  shadow: 'effects',
  filter: 'effects',
  'backdrop-filter': 'effects',
  transition: 'motion',
  'will-change': 'motion',
  transform: 'motion',
};

const PREFIXES: Record<string, Category> = {
  // Layout: where a thing sits and how big its box is.
  w: 'layout',
  h: 'layout',
  size: 'layout',
  'min-w': 'layout',
  'min-h': 'layout',
  'max-w': 'layout',
  'max-h': 'layout',
  basis: 'layout',
  grow: 'layout',
  shrink: 'layout',
  order: 'layout',
  items: 'layout',
  justify: 'layout',
  self: 'layout',
  place: 'layout',
  inset: 'layout',
  top: 'layout',
  right: 'layout',
  bottom: 'layout',
  left: 'layout',
  start: 'layout',
  end: 'layout',
  z: 'layout',
  aspect: 'layout',
  overflow: 'layout',
  overscroll: 'layout',
  columns: 'layout',
  float: 'layout',
  clear: 'layout',
  object: 'layout',
  box: 'layout',
  col: 'layout',
  row: 'layout',
  'grid-cols': 'layout',
  'grid-rows': 'layout',
  'grid-flow': 'layout',
  'auto-cols': 'layout',
  'auto-rows': 'layout',
  // Spacing: the room a thing takes up around and inside itself.
  p: 'spacing',
  px: 'spacing',
  py: 'spacing',
  pt: 'spacing',
  pr: 'spacing',
  pb: 'spacing',
  pl: 'spacing',
  ps: 'spacing',
  pe: 'spacing',
  m: 'spacing',
  mx: 'spacing',
  my: 'spacing',
  mt: 'spacing',
  mr: 'spacing',
  mb: 'spacing',
  ml: 'spacing',
  ms: 'spacing',
  me: 'spacing',
  gap: 'spacing',
  'gap-x': 'spacing',
  'gap-y': 'spacing',
  'space-x': 'spacing',
  'space-y': 'spacing',
  // Typography.
  font: 'typography',
  leading: 'typography',
  tracking: 'typography',
  'line-clamp': 'typography',
  whitespace: 'typography',
  hyphens: 'typography',
  indent: 'typography',
  list: 'typography',
  align: 'typography',
  // Shape.
  rounded: 'shape',
  // Colour.
  accent: 'color',
  caret: 'color',
  placeholder: 'color',
  // Effects.
  opacity: 'effects',
  blur: 'effects',
  backdrop: 'effects',
  brightness: 'effects',
  contrast: 'effects',
  grayscale: 'effects',
  invert: 'effects',
  saturate: 'effects',
  sepia: 'effects',
  'drop-shadow': 'effects',
  'inset-shadow': 'effects',
  'mix-blend': 'effects',
  'bg-blend': 'effects',
  // Motion.
  duration: 'motion',
  ease: 'motion',
  delay: 'motion',
  animate: 'motion',
  scale: 'motion',
  rotate: 'motion',
  translate: 'motion',
  skew: 'motion',
  origin: 'motion',
};

const TEXT_ALIGN = new Set(['left', 'center', 'right', 'justify', 'start', 'end']);
const TEXT_SHAPE = new Set(['wrap', 'nowrap', 'balance', 'pretty', 'ellipsis', 'clip']);
const SIZE_STEP = /^(xs|sm|base|md|lg|xl|\d*xl|\d+)$/;
const BORDER_STYLE = new Set(['solid', 'dashed', 'dotted', 'double', 'none', 'hidden']);
const SIDES = new Set(['t', 'r', 'b', 'l', 'x', 'y', 's', 'e']);
const BACKGROUND_NOT_COLOUR = new Set([
  'cover',
  'contain',
  'auto',
  'center',
  'top',
  'bottom',
  'left',
  'right',
  'repeat',
  'no-repeat',
  'repeat-x',
  'repeat-y',
  'fixed',
  'local',
  'scroll',
  'none',
]);

export function classify(token: string, vocabulary: Vocabulary = NO_VOCABULARY): Category {
  const { base } = parseClass(token);
  const name = utilityName(base);
  if (!name) return 'unclassified';

  const exact = EXACT[name];
  if (exact) return exact;

  const [head, ...rest] = name.split('-');
  const value = rest.join('-');

  switch (head) {
    case 'text':
      if (TEXT_ALIGN.has(value)) return 'layout';
      if (TEXT_SHAPE.has(value)) return 'typography';
      if (isColorValue(value, vocabulary)) return 'color';
      if (isLengthValue(value) || SIZE_STEP.test(value) || vocabulary.textSizes.has(value)) {
        return 'typography';
      }
      return 'typography';
    case 'bg':
      if (BACKGROUND_NOT_COLOUR.has(value)) return 'layout';
      if (value.startsWith('gradient') || value.startsWith('linear') || value.startsWith('radial')) {
        return 'effects';
      }
      return isColorValue(value, vocabulary) ? 'color' : 'effects';
    case 'border':
    case 'divide':
      return borderLike(value, vocabulary);
    case 'ring':
    case 'outline':
      if (value.startsWith('offset')) return 'shape';
      if (BORDER_STYLE.has(value) || isLengthValue(value) || /^\d+$/.test(value)) return 'shape';
      return isColorValue(value, vocabulary) ? 'color' : 'shape';
    case 'shadow':
      return isColorValue(value, vocabulary) ? 'color' : 'effects';
    case 'stroke':
      return isLengthValue(value) || /^\d+$/.test(value) ? 'shape' : 'color';
    case 'fill':
      return 'color';
    case 'from':
    case 'via':
    case 'to':
      return value.endsWith('%') ? 'effects' : 'color';
    case 'decoration':
      return isColorValue(value, vocabulary) ? 'color' : 'typography';
    default:
      break;
  }

  // Longest prefix wins, so `min-w-0` is not read as `min`.
  for (let length = name.length; length > 0; length--) {
    const dash = name.lastIndexOf('-', length);
    if (dash <= 0) break;
    const category = PREFIXES[name.slice(0, dash)];
    if (category) return category;
    length = dash;
  }
  const single = PREFIXES[head!];
  if (single) return single;

  return 'unclassified';
}

function borderLike(value: string, vocabulary: Vocabulary): Category {
  if (!value) return 'shape';
  const [first, ...rest] = value.split('-');
  if (SIDES.has(first!) && rest.length) return borderLike(rest.join('-'), vocabulary);
  if (SIDES.has(value)) return 'shape';
  if (BORDER_STYLE.has(value) || /^\d+$/.test(value) || isLengthValue(value)) return 'shape';
  return isColorValue(value, vocabulary) ? 'color' : 'shape';
}

const PALETTE_STEP = /^[a-z]+-\d{2,3}$/;
const KEYWORD_COLORS = new Set(['white', 'black', 'transparent', 'current', 'inherit']);

export function isColorValue(value: string, vocabulary: Vocabulary): boolean {
  if (!value) return false;
  const withoutModifier = value.split('/')[0]!;
  if (KEYWORD_COLORS.has(withoutModifier)) return true;
  if (vocabulary.colors.has(withoutModifier)) return true;
  if (PALETTE_STEP.test(withoutModifier)) return true;
  if (isArbitrary(withoutModifier)) {
    const inner = arbitraryValue(withoutModifier) ?? '';
    return /^(#|rgb|rgba|hsl|hsla|oklch|oklab|lab|lch|color)/i.test(inner);
  }
  // A token the project declared but whose name has a dash in it, such as
  // `card-foreground`, is already covered above; anything left that names no
  // length is more likely a colour than not.
  return false;
}

const LENGTH = /^\[?-?[\d.]+(px|rem|em|%|vh|vw|pt|dp)?\]?$/;

function isLengthValue(value: string): boolean {
  if (isArbitrary(value)) {
    const inner = arbitraryValue(value) ?? '';
    return LENGTH.test(inner) || inner.startsWith('calc');
  }
  return LENGTH.test(value);
}
