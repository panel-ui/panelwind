/**
 * no-arbitrary-values: sizes come from the scale.
 *
 * There is a second reason for this rule here, and it is the one that costs an
 * afternoon. An arbitrary value has to be compiled, and the compiler only sees
 * the class text that existed when it started: a value added to a file while
 * the dev server is running produces no CSS at all, with no error and no
 * warning, until the server is restarted. A value on the scale was compiled
 * long ago. See docs/rules/no-arbitrary-values.md.
 */
import { arbitraryValue, isArbitrary, parseClass, utilityName, utilityPrefix } from '../grammar/classes';
import { classify } from '../grammar/categories';
import { themeFor } from '../project/theme';
import { classSiteVisitors } from '../sites/collect';
import { displayPath, fileOf, reporter } from './messages';
import { entriesSchema, messageSchema, recognitionSchema } from './policy-schema';
import { withSettings } from './settings';
import { vocabularyFor } from './vocabulary';

const MESSAGES = {
  arbitrary:
    '"{{className}}" is an arbitrary value. Use a step of the scale in {{file}} — and note that a value added while the bundler is running compiles to nothing until it is restarted.',
  arbitraryWithSuggestion:
    '"{{className}}" is an arbitrary value, and "{{suggestion}}" is the same size. Use it: a value added while the bundler is running compiles to nothing until it is restarted.',
  arbitraryProperty:
    '"{{className}}" sets a property directly. Use a utility, or add a token to {{file}} if the design needs one.',
};

export const noArbitraryValues = {
  meta: {
    type: 'problem' as const,
    docs: {
      description: 'Disallow arbitrary values where a scale step exists.',
      url: 'https://github.com/panel-ui/panelwind/blob/main/docs/rules/no-arbitrary-values.md',
    },
    schema: [
      {
        type: 'object',
        properties: {
          allow: entriesSchema,
          message: messageSchema,
          ...recognitionSchema,
        },
        additionalProperties: false,
      },
    ],
    messages: MESSAGES,
  },

  create(context: any) {
    const emit = reporter(context, MESSAGES);
    const options = withSettings(context, context.options?.[0] ?? {});
    const filename = fileOf(context);
    const theme = themeFor(filename);
    const vocabulary = vocabularyFor(filename);
    const allowed = new Set(options.allow ?? []);
    const custom = typeof options.message === 'string' ? options.message : undefined;
    const file = theme.file ? displayPath(theme.file, context) : 'the theme';

    return classSiteVisitors(context, options, (site) => {
      for (const { value, node } of site.strings) {
        for (const token of value.split(/\s+/).filter(Boolean)) {
          if (allowed.has(token)) continue;
          const { base } = parseClass(token);
          if (!isArbitrary(base)) continue;
          const name = utilityName(base);

          // `[padding:12px]` is a declaration wearing a class's clothes.
          if (/^\[[^\]]*:/.test(name)) {
            emit({ node, messageId: 'arbitraryProperty', data: { className: token, file } }, custom);
            continue;
          }

          const category = classify(token, vocabulary);
          const inner = arbitraryValue(name) ?? '';
          const suggestion = stepFor(theme, utilityPrefix(name), inner, category);

          emit(
            {
              node,
              messageId: suggestion ? 'arbitraryWithSuggestion' : 'arbitrary',
              data: {
                className: token,
                suggestion: suggestion ? `${utilityPrefix(name)}-${suggestion}` : '',
                file,
              },
            },
            custom
          );
        }
      }
    });
  },
};

/** The scale that owns a utility, and the step that is the same size. */
function stepFor(
  theme: ReturnType<typeof themeFor>,
  prefix: string,
  value: string,
  category: string
): string | null {
  const scale =
    prefix === 'rounded'
      ? 'radius'
      : prefix === 'text' && category === 'typography'
        ? 'text'
        : prefix === 'shadow'
          ? 'shadow'
          : null;
  if (!scale) return null;
  const steps = theme.scales.get(scale);
  if (!steps) return null;
  const wanted = pixels(value);
  if (wanted === null) return null;
  for (const [step, declared] of steps) {
    if (pixels(declared) === wanted) return step;
  }
  return null;
}

function pixels(value: string): number | null {
  const match = value.trim().match(/^(-?[\d.]+)(px|rem)?$/);
  if (!match) return null;
  const number = Number.parseFloat(match[1]!);
  if (Number.isNaN(number)) return null;
  return match[2] === 'rem' ? number * 16 : number;
}
