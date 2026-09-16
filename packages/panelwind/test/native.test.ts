/**
 * The oracle, against a real project: a CSS entry that imports Tailwind,
 * Uniwind and a theme, compiled by the Tailwind the project has installed.
 */
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

import * as fs from 'node:fs';

import { cachedAnswers, cssFor, resetOracle } from '../src/native/client';
import { declarationVerdict, variantVerdict } from '../src/native/support';

const entry = fileURLToPath(new URL('./fixtures/app/global.css', import.meta.url));

function css(token: string): string | null {
  const answers = cssFor(entry, [token]);
  if (!answers) throw new Error('the oracle was unavailable');
  return answers.get(token) ?? null;
}

afterAll(() => {
  resetOracle();
});

describe('the project’s own Tailwind', () => {
  it('compiles an ordinary utility', () => {
    expect(css('p-4')).toContain('padding');
  });

  it('knows the project’s tokens', () => {
    expect(css('bg-primary')).toContain('--color-primary');
  });

  it('knows the variants Uniwind declares, which stock Tailwind does not', () => {
    expect(css('ios:flex')).not.toBeNull();
    expect(css('android:hidden')).not.toBeNull();
  });

  it('knows the safe-area utilities Uniwind ships', () => {
    expect(css('pt-safe')).toContain('padding-top');
  });

  it('generates nothing for a class that does not exist', () => {
    expect(css('rounded-huge')).toBeNull();
    expect(css('bg-highlight')).toBeNull();
  });
});

describe('the answer cache', () => {
  it('drops what it knew about an older version of the stylesheet', () => {
    const before = fs.statSync(entry);
    cssFor(entry, ['p-1', 'p-2', 'p-3']);
    expect(cachedAnswers()).toBeGreaterThanOrEqual(3);

    // An editor session edits the theme and lints again for hours; the answers
    // to the version that is gone are never asked for again.
    const later = new Date(before.mtimeMs + 2_000);
    fs.utimesSync(entry, later, later);
    try {
      cssFor(entry, ['p-4']);
      expect(cachedAnswers()).toBe(1);
    } finally {
      fs.utimesSync(entry, before.atime, before.mtime);
    }
  });
});

describe('what survives onto a device', () => {
  const verdictFor = (token: string) => {
    const generated = css(token);
    if (generated === null) throw new Error(`${token} generates nothing`);
    return declarationVerdict(generated);
  };

  it('keeps a utility whose properties React Native has', () => {
    expect(verdictFor('p-4').kind).toBe('native');
    expect(verdictFor('rounded-lg').kind).toBe('native');
    expect(verdictFor('bg-primary').kind).toBe('native');
    expect(verdictFor('flex-row').kind).toBe('native');
  });

  it('reports a property React Native does not have', () => {
    const verdict = verdictFor('float-right');
    expect(verdict.kind).toBe('properties');
    expect(verdict.kind === 'properties' && verdict.properties).toContain('float');
  });

  it('reports a value React Native does not have, apart from a property it does not have', () => {
    const verdict = verdictFor('grid');
    expect(verdict.kind).toBe('values');
    // React Native has a display; it does not have this one, and the two are
    // different sentences.
    expect(verdict.kind === 'values' && verdict.property).toBe('display');
    expect(verdict.kind === 'values' && verdict.keywords).toContain('flex');
  });

  it('reports a rule that styles the children instead of the element', () => {
    expect(verdictFor('space-x-2').kind).toBe('selector');
    expect(verdictFor('divide-y').kind).toBe('selector');
  });

  it('reports what Uniwind throws away', () => {
    expect(verdictFor('backdrop-blur-sm').kind).toBe('properties');
  });

  it('keeps what React Native does support, even where it reads as web-only', () => {
    // cursor and userSelect are in React Native's own style types, so a rule
    // that assumed otherwise would be wrong about them.
    expect(verdictFor('cursor-pointer').kind).toBe('native');
    expect(verdictFor('select-none').kind).toBe('native');
  });

  it('keeps a breakpoint, which is a width and nothing else', () => {
    expect(verdictFor('md:flex').kind).toBe('native');
  });
});

describe('variants with no native meaning', () => {
  it('reports the ones that wait for a pointer', () => {
    expect(variantVerdict(['hover']).kind).toBe('variant');
    expect(variantVerdict(['group-hover']).kind).toBe('variant');
    expect(variantVerdict(['peer-focus']).kind).toBe('variant');
  });

  it('reports the ones that ask about siblings', () => {
    expect(variantVerdict(['first']).kind).toBe('variant');
    expect(variantVerdict(['odd']).kind).toBe('variant');
  });

  it('leaves the ones Uniwind reads', () => {
    expect(variantVerdict(['active']).kind).toBe('native');
    expect(variantVerdict(['focus']).kind).toBe('native');
    expect(variantVerdict(['disabled']).kind).toBe('native');
    expect(variantVerdict(['dark']).kind).toBe('native');
    expect(variantVerdict(['ios']).kind).toBe('native');
    expect(variantVerdict(['md']).kind).toBe('native');
  });
});
