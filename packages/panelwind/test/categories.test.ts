/**
 * The classifier, against the classes a React Native codebase actually uses.
 *
 * Every case here comes from a real project. A class the grammar does not
 * recognise is refused by no-restyle with the wrong reason, so an unclassified
 * entry in this list is a false positive somewhere else — which is how
 * `flex-1` and `flex-row`, the two most used classes in the app this was
 * checked against, earned their own line.
 */
import { describe, expect, it } from 'vitest';

import { classify, type Category, type Vocabulary } from '../src/grammar/categories';

const vocabulary: Vocabulary = {
  colors: new Set([
    'background',
    'foreground',
    'primary',
    'primary-foreground',
    'card',
    'muted-foreground',
    'destructive',
    'border',
    'info',
  ]),
  textSizes: new Set(['xs', 'sm', 'base', 'lg', 'xl']),
};

const expected: Record<Category, string[]> = {
  layout: [
    'flex-1',
    'flex-row',
    'flex-wrap',
    'flex-col',
    'w-full',
    'h-11',
    'min-h-9',
    'max-w-sm',
    'items-center',
    'justify-between',
    'self-start',
    'absolute',
    'inset-0',
    'top-2',
    'z-10',
    'overflow-hidden',
    'aspect-square',
    'hidden',
    'shrink-0',
    'grow',
    'text-center',
    'size-6',
    // Margin is placement: where the thing sits, not how big it is.
    'mt-4',
    '-mt-2',
    'mx-auto',
    'mb-2',
  ],
  spacing: ['p-4', 'px-2.5', 'py-2', 'gap-2', 'gap-x-1.5', 'pt-safe'],
  color: [
    'bg-primary',
    'bg-card/60',
    'text-foreground',
    'text-muted-foreground',
    'border-border',
    'border-t-info',
    'bg-[#111111]',
    'fill-primary',
    'bg-zinc-500',
    'text-white',
  ],
  typography: ['text-sm', 'text-[14px]', 'font-medium', 'leading-5', 'tracking-tight', 'truncate', 'uppercase'],
  shape: ['rounded-lg', 'rounded-full', 'border', 'border-2', 'border-t', 'ring-2', 'stroke-2'],
  effects: ['opacity-60', 'shadow-sm', 'blur-sm', 'backdrop-blur-md'],
  motion: ['transition', 'duration-200', 'ease-out', 'animate-spin', 'scale-95', 'rotate-45'],
  unclassified: [],
};

describe('the classifier', () => {
  for (const [category, tokens] of Object.entries(expected) as [Category, string[]][]) {
    if (!tokens.length) continue;
    it(`reads ${category}`, () => {
      const wrong = tokens
        .map((token) => [token, classify(token, vocabulary)] as const)
        .filter(([, actual]) => actual !== category);
      expect(wrong).toEqual([]);
    });
  }

  it('keeps a variant out of the way', () => {
    expect(classify('md:flex-row', vocabulary)).toBe('layout');
    expect(classify('dark:bg-card', vocabulary)).toBe('color');
    expect(classify('ios:pt-safe', vocabulary)).toBe('spacing');
    expect(classify('active:opacity-80', vocabulary)).toBe('effects');
  });

  it('separates the utility from the colour', () => {
    expect(classify('text-lg', vocabulary)).toBe('typography');
    expect(classify('text-primary', vocabulary)).toBe('color');
    expect(classify('text-center', vocabulary)).toBe('layout');
  });
});
