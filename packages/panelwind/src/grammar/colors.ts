/**
 * Recognising a colour, and saying which token is nearest to it.
 *
 * Distances are measured in OKLab, where a step of the same size looks like a
 * step of the same size — the point being that a suggestion has to be close
 * enough that taking it does not change the design. Values arrive in every
 * notation a theme might be written in, including the precomputed rgba a
 * native theme uses because it cannot evaluate colour functions at runtime.
 */

export type Lab = { L: number; a: number; b: number; alpha: number };

const NAMED: Record<string, string> = {
  transparent: 'rgba(0,0,0,0)',
  black: '#000000',
  white: '#ffffff',
  red: '#ff0000',
  green: '#008000',
  blue: '#0000ff',
  gray: '#808080',
  grey: '#808080',
  silver: '#c0c0c0',
  yellow: '#ffff00',
  orange: '#ffa500',
  purple: '#800080',
  pink: '#ffc0cb',
  brown: '#a52a2a',
  cyan: '#00ffff',
  magenta: '#ff00ff',
  lime: '#00ff00',
  navy: '#000080',
  teal: '#008080',
  olive: '#808000',
  maroon: '#800000',
  aqua: '#00ffff',
  fuchsia: '#ff00ff',
};

const HEX = /^#([0-9a-f]{3,8})$/i;
const FUNCTION = /^([a-z]+)\(([^)]*)\)$/i;

/** Whether a string is a colour literal — what `no-raw-colors` looks for. */
export function isColorLiteral(value: string): boolean {
  const text = value.trim().toLowerCase();
  if (HEX.test(text)) return true;
  if (text in NAMED) return text !== 'transparent';
  const match = text.match(FUNCTION);
  return !!match && ['rgb', 'rgba', 'hsl', 'hsla', 'oklch', 'oklab', 'lab', 'lch'].includes(match[1]!);
}

export function toLab(value: string): Lab | null {
  const text = value.trim().toLowerCase();
  const named = NAMED[text];
  if (named) return toLab(named);

  const hex = text.match(HEX);
  if (hex) return fromHex(hex[1]!);

  const call = text.match(FUNCTION);
  if (!call) return null;
  const parts = numbersOf(call[2]!);
  const alpha = parts.alpha;

  switch (call[1]) {
    case 'rgb':
    case 'rgba':
      return fromRgb(parts.values[0] ?? 0, parts.values[1] ?? 0, parts.values[2] ?? 0, alpha);
    case 'hsl':
    case 'hsla':
      return fromHsl(parts.values[0] ?? 0, parts.values[1] ?? 0, parts.values[2] ?? 0, alpha);
    case 'oklch':
      return fromOklch(parts.values[0] ?? 0, parts.values[1] ?? 0, parts.values[2] ?? 0, alpha);
    case 'oklab':
      return { L: parts.values[0] ?? 0, a: parts.values[1] ?? 0, b: parts.values[2] ?? 0, alpha };
    default:
      return null;
  }
}

/** How far apart two colours look, alpha included so a 6% white is not a white. */
export function distance(a: Lab, b: Lab): number {
  const dL = a.L - b.L;
  const da = a.a - b.a;
  const db = a.b - b.b;
  const alpha = a.alpha - b.alpha;
  return Math.sqrt(dL * dL + da * da + db * db + alpha * alpha * 0.25);
}

export type Nearest = { token: string; distance: number };

/**
 * Two tokens often hold the same colour — a semantic one and a chart series,
 * say. Suggesting either is correct and only one is useful, so a tie goes to
 * the plainer name.
 */
const TIE = 0.0001;

function plainer(candidate: string, incumbent: string): boolean {
  const steps = (name: string) => name.split('-').length;
  if (steps(candidate) !== steps(incumbent)) return steps(candidate) < steps(incumbent);
  if (candidate.length !== incumbent.length) return candidate.length < incumbent.length;
  return candidate < incumbent;
}

/** The closest declared token, and how close it is; the caller decides on a threshold. */
export function nearestToken(value: string, tokens: Map<string, string>): Nearest | null {
  const target = toLab(value);
  if (!target) return null;
  let best: Nearest | null = null;
  for (const [token, declared] of tokens) {
    const lab = toLab(declared);
    if (!lab) continue;
    const away = distance(target, lab);
    if (!best) {
      best = { token, distance: away };
      continue;
    }
    const tied = Math.abs(away - best.distance) <= TIE;
    if (away < best.distance - TIE) best = { token, distance: away };
    else if (tied && plainer(token, best.token)) best = { token, distance: best.distance };
  }
  return best;
}

function numbersOf(body: string) {
  const cleaned = body.replace(/\//g, ' ').trim();
  const parts = cleaned.split(/[\s,]+/).filter(Boolean);
  const values: number[] = [];
  let alpha = 1;
  parts.forEach((part, index) => {
    const percent = part.endsWith('%');
    const number = Number.parseFloat(part);
    if (Number.isNaN(number)) return;
    if (index === 3) {
      alpha = percent ? number / 100 : number;
      return;
    }
    values.push(percent ? number / 100 : number);
  });
  return { values, alpha };
}

function fromHex(digits: string): Lab {
  const expand = (value: string) => Number.parseInt(value.repeat(2 / value.length), 16);
  if (digits.length === 3 || digits.length === 4) {
    const [r, g, b, a] = [...digits].map((d) => expand(d));
    return fromRgb(r!, g!, b!, digits.length === 4 ? a! / 255 : 1);
  }
  const pair = (index: number) => Number.parseInt(digits.slice(index, index + 2), 16);
  return fromRgb(pair(0), pair(2), pair(4), digits.length === 8 ? pair(6) / 255 : 1);
}

function fromRgb(r: number, g: number, b: number, alpha: number): Lab {
  return fromLinear(linear(r / 255), linear(g / 255), linear(b / 255), alpha);
}

function fromHsl(h: number, s: number, l: number, alpha: number): Lab {
  const saturation = s > 1 ? s / 100 : s;
  const lightness = l > 1 ? l / 100 : l;
  const c = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const hue = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hue % 2) - 1));
  const [r, g, b] =
    hue < 1
      ? [c, x, 0]
      : hue < 2
        ? [x, c, 0]
        : hue < 3
          ? [0, c, x]
          : hue < 4
            ? [0, x, c]
            : hue < 5
              ? [x, 0, c]
              : [c, 0, x];
  const m = lightness - c / 2;
  return fromLinear(linear(r! + m), linear(g! + m), linear(b! + m), alpha);
}

function fromOklch(L: number, chroma: number, hue: number, alpha: number): Lab {
  const radians = (hue * Math.PI) / 180;
  return { L, a: chroma * Math.cos(radians), b: chroma * Math.sin(radians), alpha };
}

function linear(channel: number) {
  return channel <= 0.04045 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
}

function fromLinear(r: number, g: number, b: number, alpha: number): Lab {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
    alpha,
  };
}
