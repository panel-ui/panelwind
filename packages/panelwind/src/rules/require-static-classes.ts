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
import { classSiteVisitors, isClassAttribute } from '../sites/collect';
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
          /**
           * Report on every element. On by default: a class the bundler never
           * sees produces no style wherever it is written, and the elements
           * this rule used to skip are where that is written most often.
           */
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
    const everywhere = options.everywhere !== false;

    return classSiteVisitors(context, options, (site) => {
      // `everywhere: false` narrows the rule back to design-system components.
      if (!site.component && !everywhere) return;
      for (const node of site.unreadable) {
        if (received(node)) continue;
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

/**
 * A class value the component was handed, rather than one it built: the
 * destructured `className`, and the same prop read off the props object. It is
 * the caller who wrote it and the caller where it can be read, so it is
 * reported there. A property reached through anything longer than one object —
 * `theme.colors.className` — is not a prop and is still reported here.
 */
function received(node: any): boolean {
  if (node.type === 'Identifier') return isClassAttribute(node.name);
  if (node.type === 'MemberExpression' && !node.computed && node.object?.type === 'Identifier') {
    return isClassAttribute(node.property?.name ?? '');
  }
  return false;
}
