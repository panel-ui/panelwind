/**
 * A local component that passes `className` straight through to a
 * design-system component is that component as far as the page is concerned,
 * so it inherits its contract: putting a colour on `<SaveButton>` changes a
 * `Button`, and the error should say so.
 *
 * Only forwarding counts. A component that renders a `Button` but keeps its
 * own `className` to itself is a component in its own right.
 */
import { walkAst, type Ast } from './parser';

export type WrapperTarget = {
  component: string;
  element: Ast;
};

/**
 * What `name`, defined in this file, forwards its className to — searched
 * through the JSX it returns, in source order, so the outermost forwarding
 * element wins.
 */
export function wrapperTargetIn(
  program: Ast,
  name: string,
  recognized: (component: string) => boolean
): WrapperTarget | null {
  const definition = definitionOf(program, name);
  if (!definition) return null;

  let target: WrapperTarget | null = null;
  walkAst(definition, (node: Ast) => {
    if (target || node.type !== 'JSXOpeningElement') return;
    const component = jsxNameText(node.name);
    if (!component || !recognized(component)) return;
    if (!forwardsClassName(node)) return;
    target = { component, element: node };
  });
  return target;
}

function definitionOf(program: Ast, name: string): Ast | null {
  let found: Ast | null = null;
  walkAst(program, (node: Ast) => {
    if (found) return;
    if (node.type === 'FunctionDeclaration' && node.id?.name === name) found = node;
    if (node.type === 'VariableDeclarator' && node.id?.type === 'Identifier' && node.id.name === name) {
      found = node.init ?? null;
    }
  });
  return found;
}

/**
 * True when the element's className mentions the `className` it was given, or
 * when a spread could be carrying one. A spread of something unreadable is
 * taken as forwarding, because the alternative is missing every wrapper
 * written with `{...props}`.
 */
function forwardsClassName(element: Ast): boolean {
  for (const attribute of element.attributes ?? []) {
    if (attribute.type === 'JSXSpreadAttribute') return true;
    if (attribute.type !== 'JSXAttribute') continue;
    if (attribute.name?.name !== 'className') continue;
    let mentions = false;
    walkAst(attribute.value, (node: Ast) => {
      if (node.type === 'Identifier' && node.name === 'className') mentions = true;
    });
    if (mentions) return true;
  }
  return false;
}

export function jsxNameText(jsxName: Ast): string {
  if (!jsxName) return '';
  if (jsxName.type === 'JSXMemberExpression') {
    return `${jsxNameText(jsxName.object)}.${jsxName.property?.name ?? ''}`;
  }
  return jsxName.name ?? '';
}

/** The `Card` of `<Card.Header>` — the name an import is looked up by. */
export function jsxRootName(jsxName: Ast): string {
  if (!jsxName) return '';
  return jsxName.type === 'JSXMemberExpression' ? jsxRootName(jsxName.object) : (jsxName.name ?? '');
}
