import { describe, expect, it } from 'vitest';

import { parseSource } from '../src/project/parser';

describe('parseSource', () => {
  it('reads a component file with oxc-parser when it is installed', () => {
    const ast = parseSource('export const A = (p: { x: number }) => <View {...p} />;', 'a.tsx');
    expect(ast?.type).toBe('Program');
    // oxc-parser gives offsets; the fallback was asked for range and loc.
    expect(ast).not.toHaveProperty('range');
    expect(typeof ast?.start).toBe('number');
  });

  it('returns null for a file that does not parse', () => {
    expect(parseSource('export const = ;', 'a.tsx')).toBeNull();
  });
});
