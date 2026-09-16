/**
 * Taking a class string apart. Everything downstream works on the pieces this
 * produces: the variants in front, the utility itself, and the modifier after
 * a slash, with brackets treated as opaque so an arbitrary value that contains
 * a colon or a slash survives intact.
 */

export function splitClasses(value: string): string[] {
  return value.split(/\s+/).filter(Boolean);
}

export type Parts = {
  /** `md`, `dark`, `ios`, `group-hover` — in the order they were written. */
  variants: string[];
  /** The utility with its variants and modifier removed. */
  base: string;
  /** What followed a slash: an opacity, a line height. */
  modifier: string | null;
  /** The whole token, unchanged. */
  token: string;
};

export function parseClass(token: string): Parts {
  const segments = splitTop(token, ':');
  const last = segments.pop() ?? '';
  const slash = topIndexOf(last, '/');
  return {
    variants: segments,
    base: slash === -1 ? last : last.slice(0, slash),
    modifier: slash === -1 ? null : last.slice(slash + 1),
    token,
  };
}

/** The `!` and `-` a utility can be written with, off the front. */
export function utilityName(base: string): string {
  return base.replace(/^!/, '').replace(/^-/, '');
}

export function isArbitrary(base: string): boolean {
  return /\[[^\]]*\]/.test(base);
}

/** The text inside the first pair of brackets: `p-[13px]` gives `13px`. */
export function arbitraryValue(base: string): string | null {
  const match = base.match(/\[([^\]]*)\]/);
  return match ? (match[1] ?? null) : null;
}

/** `bg-primary/40` and `bg-primary` share a prefix; this is how it is found. */
export function utilityPrefix(base: string): string {
  const name = utilityName(base);
  const bracket = name.indexOf('[');
  const head = bracket === -1 ? name : name.slice(0, bracket);
  const dash = head.lastIndexOf('-');
  return dash === -1 ? head : head.slice(0, dash);
}

function splitTop(value: string, separator: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let buffer = '';
  for (const character of value) {
    if (character === '[' || character === '(') depth++;
    else if (character === ']' || character === ')') depth--;
    if (character === separator && depth === 0) {
      parts.push(buffer);
      buffer = '';
      continue;
    }
    buffer += character;
  }
  parts.push(buffer);
  return parts;
}

function topIndexOf(value: string, separator: string): number {
  let depth = 0;
  for (let i = 0; i < value.length; i++) {
    const character = value[i];
    if (character === '[' || character === '(') depth++;
    else if (character === ']' || character === ')') depth--;
    else if (character === separator && depth === 0) return i;
  }
  return -1;
}
