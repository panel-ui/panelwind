/**
 * no-raw-colors: colour comes from the theme.
 *
 * A native theme cannot be patched at runtime the way a stylesheet can: the
 * values are compiled per theme, so a colour written into a screen is the one
 * colour it will ever be. It will not follow dark mode, and the day the theme
 * changes it stays behind. See docs/rules/no-raw-colors.md.
 */
import { classify, colorParts } from '../grammar/categories';
import { arbitraryValue, isArbitrary } from '../grammar/classes';
import { isColorLiteral, nearestToken } from '../grammar/colors';
import { themeFor } from '../project/theme';
import { classSiteVisitors } from '../sites/collect';
import { allStrings, styleSiteVisitors, COLOR_PROPS } from '../sites/styles';
import { displayPath, fileOf, listTokens, reporter } from './messages';
import { entriesSchema, messageSchema, recognitionSchema } from './policy-schema';
import { withSettings } from './settings';
import { vocabularyFor } from './vocabulary';

const MESSAGES = {
  classToken:
    '"{{className}}" is not a theme colour. Use one from {{file}}: {{tokens}}.',
  classSuggestion:
    '"{{className}}" is not a theme colour. Use "{{suggestion}}", which is the token this colour is nearest to.',
  value:
    '{{property}} is set to {{value}}, which is not a theme colour. Use a class, or read the token with useCSSVariable.',
  valueSuggestion:
    '{{property}} is set to {{value}}, which is the token "{{suggestion}}". Use it: a value written here will not follow the theme.',
};

/** How close a colour has to be before naming a token is help rather than noise. */
const NEAR = 0.06;

export const noRawColors = {
  meta: {
    type: 'problem' as const,
    docs: {
      description: 'Disallow colours that are not theme tokens.',
      url: 'https://github.com/panel-ui/panelwind/blob/main/docs/rules/no-raw-colors.md',
    },
    schema: [
      {
        type: 'object',
        properties: {
          allow: entriesSchema,
          message: messageSchema,
          scanAllStrings: { type: 'boolean' },
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

    const reportValue = (property: string, value: string, node: any) => {
      if (allowed.has(value)) return;
      const nearest = nearestToken(value, theme.colorValues);
      const close = nearest && nearest.distance <= NEAR;
      emit(
        {
          node,
          messageId: close ? 'valueSuggestion' : 'value',
          data: {
            property,
            value: `"${value}"`,
            suggestion: close ? nearest.token : '',
            file,
            tokens: listTokens(theme.colors),
          },
        },
        custom
      );
    };

    const classVisitors = classSiteVisitors(context, options, (site) => {
      for (const { value, node } of site.strings) {
        for (const token of value.split(/\s+/).filter(Boolean)) {
          if (allowed.has(token)) continue;
          if (classify(token, vocabulary) !== 'color') continue;
          const parts = colorParts(token);
          if (!parts) continue;
          const colour = parts.value.split('/')[0]!;
          if (theme.colors.has(colour) || KEYWORDS.has(colour)) continue;

          // An arbitrary colour carries its own value, so the nearest token
          // can be named. A palette class does not, so the tokens are listed.
          const literal = isArbitrary(colour) ? (arbitraryValue(colour) ?? '') : '';
          const nearest = literal ? nearestToken(literal, theme.colorValues) : null;
          const close = nearest && nearest.distance <= NEAR;
          emit(
            {
              node,
              messageId: close ? 'classSuggestion' : 'classToken',
              data: {
                className: token,
                suggestion: close ? `${parts.prefix}-${nearest.token}` : '',
                file,
                tokens: listTokens(theme.colors),
              },
            },
            custom
          );
        }
      }
    });

    const styleVisitors = styleSiteVisitors(context, options, (site) => {
      for (const entry of site.values) {
        if (typeof entry.value !== 'string') continue;
        const looksLikeColour =
          site.kind === 'prop' ||
          COLOR_PROPS.has(entry.property) ||
          /color/i.test(entry.property);
        if (!looksLikeColour) continue;
        if (!isColorLiteral(entry.value)) continue;
        reportValue(entry.property, entry.value, entry.node);
      }
    });

    const merged = mergeVisitors(classVisitors, styleVisitors);

    if (options.scanAllStrings) {
      const seen = new WeakSet<object>();
      merged.Program = (node: any) => {
        allStrings(context, (value, stringNode) => {
          if (seen.has(stringNode)) return;
          seen.add(stringNode);
          if (!isColorLiteral(value)) return;
          reportValue('a colour', value, stringNode);
        });
        void node;
      };
    }

    return merged;
  },
};

const KEYWORDS = new Set(['transparent', 'current', 'inherit']);

/** Two visitor objects, run in order, for the same node types. */
function mergeVisitors(
  first: Record<string, (node: any) => void>,
  second: Record<string, (node: any) => void>
): Record<string, (node: any) => void> {
  const merged: Record<string, (node: any) => void> = { ...first };
  for (const [selector, visit] of Object.entries(second)) {
    const existing = merged[selector];
    merged[selector] = existing
      ? (node: any) => {
          existing(node);
          visit(node);
        }
      : visit;
  }
  return merged;
}
