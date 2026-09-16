/**
 * no-restyle: a component's className carries what its contract allows, and
 * its appearance comes from its variants.
 *
 * The rule exists to make one answer easy to give: when a screen needs a
 * button that looks different, the answer is a variant, not a class on the
 * call site. So every diagnostic names the variants that exist, and the file
 * to add one to if none of them fits. See docs/rules/no-restyle.md.
 */
import { APPEARANCE } from '../grammar/categories';
import { splitClasses } from '../grammar/classes';
import { sizeNamesFor, variantNamesFor } from '../project/variants';
import { classSiteVisitors, type ClassSite } from '../sites/collect';
import { compileContracts, configErrorVisitors } from './contracts';
import { displayPath, fileOf, reporter } from './messages';
import { contractsSchema, entriesSchema, messageSchema, recognitionSchema } from './policy-schema';
import { withSettings } from './settings';
import { vocabularyFor } from './vocabulary';

const NOT_ALLOWED = '"{{className}}" is not allowed on <{{component}}>:';
const OWNS = '<{{component}}> owns its {{category}}.';
const OWNS_VIA_WRAPPER =
  '<{{wrapper}}> passes className to <{{component}}>, which owns its {{category}}.';
const NEW_VARIANT = 'only if the design calls for a treatment none of them provides.';
const NEW_SIZE = 'Add a size in {{file}} only if the design calls for one.';

const MESSAGES = {
  appearance: `${NOT_ALLOWED} ${OWNS} Use one of its variants. Add a new variant ${NEW_VARIANT}`,
  appearanceWithVariants: `${NOT_ALLOWED} ${OWNS} Use a variant: {{variants}}. Add a new variant in {{file}} ${NEW_VARIANT}`,
  appearanceNoVariants: `${NOT_ALLOWED} ${OWNS} Add a variant in {{file}} only if the design calls for this treatment.`,
  appearanceViaWrapper: `"{{className}}" is not allowed on <{{wrapper}}>: ${OWNS_VIA_WRAPPER} Use a variant{{variantsSuffix}}.`,
  // Padding on a control is nearly always a size; room around it is layout,
  // and layout belongs to whatever is placing it.
  spacingWithSizes: `${NOT_ALLOWED} ${OWNS} Use a size ({{sizes}}), or {{around}} for room around it. ${NEW_SIZE}`,
  spacingNoSizes: `${NOT_ALLOWED} ${OWNS} For room around it, use {{around}}.`,
  spacingViaWrapperWithSizes: `"{{className}}" is not allowed on <{{wrapper}}>: ${OWNS_VIA_WRAPPER} Use a size ({{sizes}}), or {{around}} for room around it.`,
  denied: `${NOT_ALLOWED} its contract denies {{entries}}.`,
  layout: `${NOT_ALLOWED} its contract allows {{entries}}. Use one of those, or put the class on the view around it.`,
  layoutClosed: `${NOT_ALLOWED} its contract allows no classes. Put the class on the view around it instead.`,
  unclassified: `${NOT_ALLOWED} it is not a class the grammar recognises. Fix the spelling, or use a class Tailwind generates.`,
};

export const noRestyle = {
  meta: {
    type: 'problem' as const,
    docs: {
      description:
        'Disallow classes on design-system components beyond what the rule and the component’s contract allow.',
      url: 'https://github.com/panel-ui/panelwind/blob/main/docs/rules/no-restyle.md',
    },
    schema: [
      {
        type: 'object',
        properties: {
          allow: entriesSchema,
          deny: entriesSchema,
          message: messageSchema,
          contracts: contractsSchema,
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
    const vocabulary = vocabularyFor(filename);

    let contracts: ReturnType<typeof compileContracts>;
    try {
      contracts = compileContracts(options.contracts, {
        allow: options.allow,
        deny: options.deny,
        message: options.message,
      });
    } catch (error) {
      return configErrorVisitors(context, error);
    }

    return classSiteVisitors(context, options, (site) => {
      if (!site.component) return;
      const component = site.component;
      const where = site.componentFile ? displayPath(site.componentFile, context) : '';

      for (const { value, node } of site.strings) {
        for (const token of splitClasses(value)) {
          const verdict = contracts.decide(component, token, vocabulary);
          if (verdict.kind === 'ok') continue;

          // Every finding carries the same slots whatever its category, so a
          // project's own wording can use any of them.
          const data: Record<string, string> = {
            className: token,
            component,
            category: verdict.category,
            entries: verdict.entries.join(' '),
            wrapper: site.wrapper ?? '',
            file: where,
            variants: '',
            variantsSuffix: '',
            sizes: '',
            around: '',
          };

          if (verdict.kind === 'denied') {
            emit({ node, messageId: 'denied', data }, verdict.message);
            continue;
          }

          if (verdict.category === 'layout') {
            emit(
              {
                node,
                messageId: verdict.entries.length ? 'layout' : 'layoutClosed',
                data,
              },
              verdict.message
            );
            continue;
          }

          if (verdict.category === 'unclassified') {
            emit({ node, messageId: 'unclassified', data }, verdict.message);
            continue;
          }

          if (verdict.category === 'spacing') {
            const sizes = sizeNamesFor(site.componentFile, component);
            data.sizes = sizes?.join(', ') ?? '';
            data.around = aroundFor(site, contracts, component, token, vocabulary);
            emit(
              {
                node,
                messageId: site.wrapper
                  ? sizes
                    ? 'spacingViaWrapperWithSizes'
                    : 'spacingNoSizes'
                  : sizes
                    ? 'spacingWithSizes'
                    : 'spacingNoSizes',
                data,
              },
              verdict.message
            );
            continue;
          }

          const variants = variantNamesFor(site.componentFile, component);
          data.variants = variants?.join(', ') ?? '';
          data.variantsSuffix = variants ? `: ${variants.join(', ')}` : '';
          emit(
            {
              node,
              messageId: site.wrapper
                ? 'appearanceViaWrapper'
                : !site.componentFile
                  ? 'appearance'
                  : variants
                    ? 'appearanceWithVariants'
                    : 'appearanceNoVariants',
              data,
            },
            verdict.message
          );
        }
      }
    });

    /** Where room around a component can go, built only from what is allowed. */
    function aroundFor(
      site: ClassSite,
      compiled: ReturnType<typeof compileContracts>,
      component: string,
      token: string,
      words: ReturnType<typeof vocabularyFor>
    ): string {
      const places: string[] = [];
      if (compiled.accepts(component, 'm-4', words)) places.push('margin here');
      const container = site.ancestors.find((name) => compiled.accepts(name, token, words));
      places.push(container ? `spacing on <${container}>` : 'gap on the view around it');
      return places.length > 1 ? `${places[0]} or ${places[1]}` : places[0]!;
    }
  },
};

/** The categories a component can be said to own, for documentation and tests. */
export const OWNED_CATEGORIES = APPEARANCE;
