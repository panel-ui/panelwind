/**
 * A component's variants, read from the file that defines it — the values a
 * diagnostic offers instead of the class it just refused.
 *
 * Both shapes in use here are read. The flat one maps a variant to a string of
 * classes; the slot one maps it to an object, one entry per part of the
 * component, which is what a component with a root, a label and a spinner
 * needs. Props typed as a union of strings count too, for a component that
 * takes a variant it does not build with a variant function.
 */
import { astFor, walkAst, type Ast } from './parser';
import { memoize, modifiedAt } from './fs';

const VARIANT_FUNCTIONS = new Set(['tv', 'cva']);
const AXIS_PROPS = new Set(['variant', 'size', 'tone', 'intent', 'color']);
/** A boolean axis is a prop, not a value anybody can be told to use. */
const BOOLEAN_KEYS = new Set(['true', 'false']);

export type VariantAxes = Map<string, string[]>;

export function variantDefinitionsOf(file: string): VariantAxes {
  const stamp = modifiedAt(file) ?? 0;
  return memoize(`variants:${file}:${stamp}`, () => read(file));
}

function read(file: string): VariantAxes {
  const ast = astFor(file);
  const axes: VariantAxes = new Map();
  if (!ast) return axes;

  walkAst(ast, (node: Ast) => {
    if (node.type === 'CallExpression' && VARIANT_FUNCTIONS.has(calleeName(node))) {
      const config = node.arguments?.[0];
      if (config?.type === 'ObjectExpression') fromConfig(config, axes);
      return;
    }
    if (node.type === 'TSPropertySignature') fromProp(node, axes);
  });

  return axes;
}

function calleeName(node: Ast): string {
  const callee = node.callee;
  if (!callee) return '';
  if (callee.type === 'Identifier') return callee.name;
  if (callee.type === 'MemberExpression') return callee.property?.name ?? '';
  return '';
}

function fromConfig(config: Ast, axes: VariantAxes) {
  const variants = propertyOf(config, 'variants');
  if (variants?.type !== 'ObjectExpression') return;
  for (const property of variants.properties ?? []) {
    const axis = keyOf(property);
    if (!axis || property.value?.type !== 'ObjectExpression') continue;
    const values = (property.value.properties ?? [])
      .map((entry: Ast) => keyOf(entry))
      .filter((value: string | null): value is string => !!value && !BOOLEAN_KEYS.has(value));
    if (values.length) add(axes, axis, values);
  }
}

function fromProp(node: Ast, axes: VariantAxes) {
  const name = keyOf(node);
  if (!name || !AXIS_PROPS.has(name)) return;
  const annotation = node.typeAnnotation?.typeAnnotation;
  const members =
    annotation?.type === 'TSUnionType'
      ? annotation.types
      : annotation?.type === 'TSLiteralType'
        ? [annotation]
        : [];
  const values = members
    .map((member: Ast) =>
      member?.type === 'TSLiteralType' && typeof member.literal?.value === 'string'
        ? member.literal.value
        : null
    )
    .filter((value: string | null): value is string => !!value);
  if (values.length) add(axes, name, values);
}

function add(axes: VariantAxes, axis: string, values: string[]) {
  const existing = axes.get(axis) ?? [];
  const merged = [...existing];
  for (const value of values) if (!merged.includes(value)) merged.push(value);
  axes.set(axis, merged);
}

function propertyOf(object: Ast, name: string): Ast | null {
  for (const property of object.properties ?? []) {
    if (keyOf(property) === name) return property.value;
  }
  return null;
}

function keyOf(property: Ast): string | null {
  const key = property?.key;
  if (!key) return null;
  if (key.type === 'Identifier') return key.name;
  if (key.type === 'Literal' && typeof key.value === 'string') return key.value;
  return null;
}

/**
 * What to offer for an appearance finding: the `variant` axis when the file
 * names one, and otherwise every axis that is not a size — a component whose
 * only axis is `tone` should still be answered with its tones.
 */
export function variantNamesFor(file: string | null, _component: string): string[] | null {
  if (!file) return null;
  const axes = variantDefinitionsOf(file);
  const named = axes.get('variant');
  if (named?.length) return named;
  const rest: string[] = [];
  for (const [axis, values] of axes) {
    if (axis === 'size') continue;
    rest.push(...values);
  }
  return rest.length ? rest : null;
}

/** What to offer for a spacing finding: the size axis, when the component has one. */
export function sizeNamesFor(file: string | null, _component: string): string[] | null {
  if (!file) return null;
  const sizes = variantDefinitionsOf(file).get('size');
  return sizes?.length ? sizes : null;
}
