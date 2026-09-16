/**
 * no-unknown-classes: a class that generates nothing.
 *
 * On a device this is the quietest failure there is. A misspelled class is not
 * an error and not a warning — the property simply never arrives, and the
 * element keeps whatever its parent gave it. See docs/rules/no-unknown-classes.md.
 */
import { cssFor, classListFor } from '../native/client';
import { parseClass } from '../grammar/classes';
import { didYouMean } from '../grammar/similar';
import { projectFor } from '../project/config';
import { warnOnce } from '../project/warn';
import { classSiteVisitors } from '../sites/collect';
import { displayPath, fileOf, reporter } from './messages';
import { entriesSchema, messageSchema, recognitionSchema } from './policy-schema';
import { withSettings } from './settings';

const MESSAGES = {
  unknown:
    '"{{className}}" generates no CSS in this project, so nothing of it reaches the device. Use a class the theme defines, or add it to {{file}}.',
  unknownWithSuggestion:
    '"{{className}}" generates no CSS in this project, so nothing of it reaches the device. Did you mean "{{suggestion}}"?',
  unknownVariant:
    '"{{className}}" generates no CSS in this project: "{{variant}}" is not a variant it declares. The platform variants are ios, android, native, web and tv.',
};

export const noUnknownClasses = {
  meta: {
    type: 'problem' as const,
    docs: {
      description: 'Disallow classes the project’s Tailwind cannot generate.',
      url: 'https://github.com/panel-ui/panelwind/blob/main/docs/rules/no-unknown-classes.md',
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
    const project = projectFor(filename);
    const allowed = new Set(options.allow ?? []);
    const custom = typeof options.message === 'string' ? options.message : undefined;

    if (!project.cssEntry) {
      warnOnce(
        `entry:${project.root}`,
        `no CSS entry was found for ${project.root}; no-unknown-classes is standing down. Name one in panelui.json.`
      );
      return {};
    }
    const entry = project.cssEntry;

    return classSiteVisitors(context, options, (site) => {
      const tokens = new Map<string, any>();
      for (const { value, node } of site.strings) {
        for (const token of value.split(/\s+/).filter(Boolean)) {
          if (!allowed.has(token) && !tokens.has(token)) tokens.set(token, node);
        }
      }
      if (!tokens.size) return;

      const answers = cssFor(entry, [...tokens.keys()]);
      if (!answers) return;

      for (const [token, node] of tokens) {
        if (answers.get(token) !== null) continue;
        const { variants, base } = parseClass(token);
        const known = classListFor(entry);

        // A base that compiles on its own means the variant is what is wrong,
        // and saying which half is broken is most of the fix.
        if (variants.length) {
          const baseAnswer = cssFor(entry, [base]);
          if (baseAnswer?.get(base)) {
            emit(
              { node, messageId: 'unknownVariant', data: { className: token, variant: variants[0]! } },
              custom
            );
            continue;
          }
        }

        const suggestion = known ? didYouMean(base, known) : null;
        emit(
          {
            node,
            messageId: suggestion ? 'unknownWithSuggestion' : 'unknown',
            data: {
              className: token,
              suggestion: suggestion ? withVariants(variants, suggestion) : '',
              file: displayPath(project.themeFile ?? entry, context),
            },
          },
          custom
        );
      }
    });
  },
};

function withVariants(variants: string[], base: string): string {
  return variants.length ? `${variants.join(':')}:${base}` : base;
}
