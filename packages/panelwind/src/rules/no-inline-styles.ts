/**
 * no-inline-styles: a style a class could express belongs in className.
 *
 * This rule is narrower than its web counterpart, and has to be. React Native
 * needs `style`: an animated style is an object because it is a value that
 * changes on the UI thread, and a measured height is a number nobody can write
 * as a class. So only a style whose every value is a literal is reported —
 * that one is a class written the long way round, and it is invisible to every
 * other rule here, which is the real cost. See docs/rules/no-inline-styles.md.
 */
import { styleSiteVisitors } from '../sites/styles';
import { listOf, reporter } from './messages';
import { entriesSchema, messageSchema, recognitionSchema } from './policy-schema';
import { withSettings } from './settings';

const MESSAGES = {
  style:
    'This style sets {{properties}}, which a class can express. Put it in className: a style object is outside the theme, so nothing checks it and nothing follows a theme change.',
  styleOnComponent:
    'This style sets {{properties}} on <{{component}}>, which a class can express. Put it in className.',
  sheet:
    'StyleSheet.create sets {{properties}} in "{{attribute}}", which classes can express. A stylesheet is outside the theme, so nothing checks it and nothing follows a theme change.',
};

/** Properties whose value is nearly always measured or animated. */
const ALWAYS_DYNAMIC = new Set(['transform', 'shadowOffset', 'elevation']);

export const noInlineStyles = {
  meta: {
    type: 'suggestion' as const,
    docs: {
      description: 'Disallow static style objects where classes would do.',
      url: 'https://github.com/panel-ui/panelwind/blob/main/docs/rules/no-inline-styles.md',
    },
    schema: [
      {
        type: 'object',
        properties: {
          allow: entriesSchema,
          message: messageSchema,
          /** Also report StyleSheet.create, which is the same thing with a name. */
          stylesheets: { type: 'boolean' },
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
    const allowed = new Set(options.allow ?? []);
    const custom = typeof options.message === 'string' ? options.message : undefined;
    const includeSheets = options.stylesheets !== false;

    return styleSiteVisitors(context, options, (site) => {
      // Anything the linter could not read is a value that changes, and a
      // value that changes is what `style` is for.
      if (site.dynamic) return;
      if (site.kind === 'prop') return;
      if (site.kind === 'stylesheet' && !includeSheets) return;

      const properties = site.values
        .map((entry) => entry.property)
        .filter((property) => !allowed.has(property) && !ALWAYS_DYNAMIC.has(property));
      if (!properties.length) return;

      emit(
        {
          node: site.node,
          messageId:
            site.kind === 'stylesheet'
              ? 'sheet'
              : site.component
                ? 'styleOnComponent'
                : 'style',
          data: {
            properties: listOf(properties),
            component: site.component ?? site.element ?? '',
            attribute: site.attribute,
          },
        },
        custom
      );
    });
  },
};
