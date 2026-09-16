/**
 * Style objects, which React Native has and a browser page does not need.
 *
 * `style` is not a mistake here the way an inline style is on the web: an
 * animated style has to be an object, because it is a value that changes on
 * the UI thread. So what is collected is the shape of the object, not its
 * presence, and a value that cannot be written as a literal is left alone.
 */
import { createReader, type Reader, type Recognition } from './collect';
import { walkAst, type Ast } from '../project/parser';
import { jsxNameText } from '../project/wrappers';

export type StyleValue = {
  property: string;
  /** The literal the property was given, when it is one. */
  value: string | number | null;
  node: Ast;
};

export type StyleSite = {
  /** `style`, a colour prop such as `tintColor`, or `StyleSheet.create`. */
  kind: 'style' | 'prop' | 'stylesheet';
  attribute: string;
  values: StyleValue[];
  /** True when part of the object is computed, so it cannot be a class. */
  dynamic: boolean;
  component: string | null;
  componentFile: string | null;
  element: string | null;
  node: Ast;
};

/** Props that take a colour rather than a style object. */
export const COLOR_PROPS = new Set([
  'color',
  'tintColor',
  'backgroundColor',
  'borderColor',
  'placeholderTextColor',
  'selectionColor',
  'cursorColor',
  'shadowColor',
  'underlayColor',
  'activeOutlineColor',
  'outlineColor',
  // react-native-svg takes its colours as props.
  'fill',
  'stroke',
]);

export function styleSiteVisitors(
  context: any,
  options: Recognition,
  onSite: (site: StyleSite) => void
): Record<string, (node: Ast) => void> {
  const reader = createReader(context, options);

  return {
    JSXOpeningElement(node: Ast) {
      const resolved = reader.resolveElement(node.name);
      const element = jsxNameText(node.name);

      for (const attribute of node.attributes ?? []) {
        if (attribute.type !== 'JSXAttribute') continue;
        const name = attribute.name?.name;
        if (typeof name !== 'string') continue;

        if (name === 'style' || name.endsWith('Style')) {
          const read = readStyle(reader, attribute.value);
          if (!read.values.length && !read.dynamic) continue;
          onSite({
            kind: 'style',
            attribute: name,
            values: read.values,
            dynamic: read.dynamic,
            component: resolved?.component ?? null,
            componentFile: resolved?.file ?? null,
            element,
            node: attribute,
          });
          continue;
        }

        if (COLOR_PROPS.has(name)) {
          const literal = literalOf(reader, attribute.value);
          if (literal === null) continue;
          onSite({
            kind: 'prop',
            attribute: name,
            values: [{ property: name, value: literal, node: attribute.value ?? attribute }],
            dynamic: false,
            component: resolved?.component ?? null,
            componentFile: resolved?.file ?? null,
            element,
            node: attribute,
          });
        }
      }
    },

    CallExpression(node: Ast) {
      const callee = node.callee;
      if (
        callee?.type !== 'MemberExpression' ||
        callee.object?.name !== 'StyleSheet' ||
        callee.property?.name !== 'create'
      ) {
        return;
      }
      const sheet = node.arguments?.[0];
      if (sheet?.type !== 'ObjectExpression') return;
      for (const entry of sheet.properties ?? []) {
        if (entry.type !== 'Property' || entry.value?.type !== 'ObjectExpression') continue;
        const read = readObject(reader, entry.value);
        if (!read.values.length) continue;
        onSite({
          kind: 'stylesheet',
          attribute: entry.key?.name ?? 'style',
          values: read.values,
          dynamic: read.dynamic,
          component: null,
          componentFile: null,
          element: null,
          node: entry,
        });
      }
    },
  };
}

function readStyle(reader: Reader, value: Ast): { values: StyleValue[]; dynamic: boolean } {
  if (!value) return { values: [], dynamic: false };
  if (value.type === 'JSXExpressionContainer') return readStyle(reader, value.expression);
  if (value.type === 'ObjectExpression') return readObject(reader, value);
  if (value.type === 'ArrayExpression') {
    const values: StyleValue[] = [];
    let dynamic = false;
    for (const element of value.elements ?? []) {
      const read = readStyle(reader, element);
      values.push(...read.values);
      dynamic ||= read.dynamic;
    }
    return { values, dynamic };
  }
  if (value.type === 'Identifier') {
    const held = reader.locals.get(value.name);
    // An animated style is a value that changes; there is nothing static in it
    // to report, and following it one hop would only find the hook that made it.
    if (held && held.type === 'ObjectExpression') return readObject(reader, held);
    return { values: [], dynamic: true };
  }
  return { values: [], dynamic: true };
}

function readObject(reader: Reader, object: Ast): { values: StyleValue[]; dynamic: boolean } {
  const values: StyleValue[] = [];
  let dynamic = false;

  for (const property of object.properties ?? []) {
    if (property.type !== 'Property') {
      dynamic = true;
      continue;
    }
    const name =
      property.key?.type === 'Identifier' && !property.computed
        ? property.key.name
        : property.key?.type === 'Literal'
          ? String(property.key.value)
          : null;
    if (!name) {
      dynamic = true;
      continue;
    }
    const literal = literalOf(reader, property.value);
    if (literal === null) {
      dynamic = true;
      values.push({ property: name, value: null, node: property });
      continue;
    }
    values.push({ property: name, value: literal, node: property });
  }

  return { values, dynamic };
}

function literalOf(reader: Reader, node: Ast, hops = 0): string | number | null {
  if (!node) return null;
  if (node.type === 'JSXExpressionContainer') return literalOf(reader, node.expression, hops);
  if (node.type === 'Literal') {
    return typeof node.value === 'string' || typeof node.value === 'number' ? node.value : null;
  }
  if (node.type === 'TemplateLiteral' && !node.expressions?.length) {
    return node.quasis?.[0]?.value?.cooked ?? null;
  }
  if (node.type === 'Identifier' && hops < 1) {
    const held = reader.locals.get(node.name);
    return held ? literalOf(reader, held, hops + 1) : null;
  }
  return null;
}

/** Every string in the file, for the rules that can be asked to look everywhere. */
export function allStrings(context: any, onString: (value: string, node: Ast) => void) {
  const program: Ast = context.sourceCode?.ast ?? context.getSourceCode?.().ast;
  if (!program) return;
  walkAst(program, (node: Ast) => {
    if (node.type === 'Literal' && typeof node.value === 'string') onString(node.value, node);
  });
}
