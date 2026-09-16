/**
 * no-web-only-classes: a class that compiles, and does nothing on a device.
 *
 * This is the one a web linter cannot have. `space-x-2`, `float-right`,
 * `grid`, `hover:bg-primary` and `backdrop-blur-sm` are all real Tailwind, all
 * generate CSS, and none of them survive into a React Native style. Nothing
 * fails: the layout is simply not the one the class describes, and the class
 * sits in the source looking like it works.
 *
 * See docs/rules/no-web-only-classes.md and docs/native.md.
 */
import { cssFor } from '../native/client';
import { declarationVerdict, variantVerdict } from '../native/support';
import { parseClass } from '../grammar/classes';
import { projectFor } from '../project/config';
import { warnOnce } from '../project/warn';
import { classSiteVisitors } from '../sites/collect';
import { fileOf, listOf, reporter } from './messages';
import { entriesSchema, messageSchema, recognitionSchema } from './policy-schema';
import { withSettings } from './settings';

const MESSAGES = {
  variant:
    '"{{className}}" does nothing on a device: {{reason}}',
  selector:
    '"{{className}}" does nothing on a device: {{reason}}. Put the spacing on the children, or use `gap-*` on this view.',
  properties:
    '"{{className}}" does nothing on a device: React Native has no {{properties}}.',
  values:
    '"{{className}}" does nothing on a device: React Native\'s {{property}} does not take {{value}}{{alternatives}}.',
  empty: '"{{className}}" does nothing on a device: it generates nothing a native style can carry.',
};

/** A file that only ever runs in a browser is allowed to be a browser file. */
const WEB_FILE = /\.web\.[jt]sx?$/;

export const noWebOnlyClasses = {
  meta: {
    type: 'problem' as const,
    docs: {
      description: 'Disallow classes that generate CSS React Native cannot apply.',
      url: 'https://github.com/panel-ui/panelwind/blob/main/docs/rules/no-web-only-classes.md',
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
    if (WEB_FILE.test(filename)) return {};

    const project = projectFor(filename);
    const allowed = new Set(options.allow ?? []);
    const custom = typeof options.message === 'string' ? options.message : undefined;

    if (!project.cssEntry) {
      warnOnce(
        `entry:${project.root}`,
        `no CSS entry was found for ${project.root}; no-web-only-classes is standing down. Name one in panelui.json.`
      );
      return {};
    }
    const entry = project.cssEntry;

    return classSiteVisitors(context, options, (site) => {
      const tokens = new Map<string, any>();
      for (const { value, node } of site.strings) {
        for (const token of value.split(/\s+/).filter(Boolean)) {
          if (allowed.has(token) || tokens.has(token)) continue;
          // `web:` is somebody saying this one is for the browser.
          if (parseClass(token).variants.includes('web')) continue;
          tokens.set(token, node);
        }
      }
      if (!tokens.size) return;

      for (const [token, node] of tokens) {
        const { variants } = parseClass(token);
        const fromVariant = variantVerdict(variants);
        if (fromVariant.kind === 'variant') {
          emit(
            {
              node,
              messageId: 'variant',
              data: { className: token, variant: fromVariant.variant, reason: fromVariant.reason },
            },
            custom
          );
          continue;
        }
      }

      const remaining = [...tokens.keys()].filter(
        (token) => variantVerdict(parseClass(token).variants).kind === 'native'
      );
      if (!remaining.length) return;
      const answers = cssFor(entry, remaining);
      if (!answers) return;

      for (const token of remaining) {
        const generated = answers.get(token);
        // A class that generates nothing is no-unknown-classes' to report.
        if (generated == null) continue;
        const verdict = declarationVerdict(generated);
        if (verdict.kind === 'native') continue;
        const node = tokens.get(token);

        if (verdict.kind === 'selector') {
          emit({ node, messageId: 'selector', data: { className: token, reason: verdict.reason } }, custom);
        } else if (verdict.kind === 'properties') {
          emit(
            {
              node,
              messageId: 'properties',
              data: { className: token, properties: listOf(verdict.properties) },
            },
            custom
          );
        } else if (verdict.kind === 'values') {
          emit(
            {
              node,
              messageId: 'values',
              data: {
                className: token,
                property: verdict.property,
                value: verdict.value,
                alternatives: verdict.keywords.length
                  ? ` — only ${listOf(verdict.keywords)}`
                  : '',
              },
            },
            custom
          );
        } else if (verdict.kind === 'empty') {
          emit({ node, messageId: 'empty', data: { className: token } }, custom);
        }
      }
    });
  },
};
