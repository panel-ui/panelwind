/**
 * require-static-classes: a class the compiler cannot see is not a class.
 *
 * `bg-${tone}` never reaches the bundler as text, so no CSS is generated for
 * it and the style does not exist at runtime. On the web this degrades — the
 * page is unstyled but present. Here the property simply never arrives, which
 * looks exactly like a component that ignores the prop.
 *
 * The fix is always the same shape: write the whole class in each branch, so
 * the text is there to be compiled. See docs/rules/require-static-classes.md.
 */
import { classSiteVisitors } from '../sites/collect';
import { reporter } from './messages';
import { messageSchema, recognitionSchema } from './policy-schema';
import { withSettings } from './settings';

const MESSAGES = {
  unreadable:
    'This class value cannot be read, so the bundler never sees the class and no style is generated for it. Write the whole class in each branch — `tone === "danger" ? "bg-destructive" : "bg-primary"`.',
  unreadableOnComponent:
    'This class value on <{{component}}> cannot be read, so the bundler never sees the class and no style is generated for it. Write the whole class in each branch.',
};

export const requireStaticClasses = {
  meta: {
    type: 'problem' as const,
    docs: {
      description: 'Require class values the bundler can see.',
      url: 'https://github.com/panel-ui/panelwind/blob/main/docs/rules/require-static-classes.md',
    },
    schema: [
      {
        type: 'object',
        properties: {
          message: messageSchema,
          /** Report everywhere, not only on design-system components. */
          everywhere: { type: 'boolean' },
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
    const custom = typeof options.message === 'string' ? options.message : undefined;
    const everywhere = options.everywhere === true;

    return classSiteVisitors(context, options, (site) => {
      // A className a component was handed is the caller's to answer for, and
      // the caller is where it can be read.
      if (!site.component && !everywhere) return;
      for (const node of site.unreadable) {
        if (node.type === 'Identifier' && node.name === 'className') continue;
        emit(
          {
            node,
            messageId: site.component ? 'unreadableOnComponent' : 'unreadable',
            data: { component: site.component ?? '' },
          },
          custom
        );
      }
    });
  },
};
