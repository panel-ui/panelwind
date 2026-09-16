/** The project's own words: its colour tokens and its text scale. */
import type { Vocabulary } from '../grammar/categories';
import { themeFor } from '../project/theme';

export function vocabularyFor(file: string): Vocabulary {
  const theme = themeFor(file);
  return {
    colors: theme.colors,
    textSizes: new Set(theme.scales.get('text')?.keys() ?? []),
  };
}
