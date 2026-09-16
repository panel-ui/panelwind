/**
 * Every place a class string enters a file, and which component it lands on.
 *
 * Uniwind compiles the class text it can see in source, so text plus one hop
 * through a local variable covers everything that can actually render. What
 * the hop cannot read is reported as unreadable rather than treated as empty —
 * on a device an unreadable class is not a risk, it is nothing at all.
 */
import { componentFileFor, componentsFor, isComponentFile } from '../project/components';
import { DESIGN_SYSTEM_PACKAGES, projectFor } from '../project/config';
import { resolveImport } from '../project/resolve';
import { jsxNameText, jsxRootName, wrapperTargetIn } from '../project/wrappers';
import { walkAst, type Ast } from '../project/parser';

export const DEFAULT_MERGE_FUNCTIONS = ['cn', 'cx', 'clsx', 'classNames', 'twMerge', 'twJoin'];
export const DEFAULT_VARIANT_FUNCTIONS = ['tv', 'cva'];

const CLASS_ATTRIBUTE = /class(name)?s?$/i;

export function isClassAttribute(name: string): boolean {
  return CLASS_ATTRIBUTE.test(name);
}

export type ClassString = {
  value: string;
  node: Ast;
};

export type ClassSite = {
  /** Class text that reaches this site. */
  strings: ClassString[];
  /** Expressions whose class text could not be read. */
  unreadable: Ast[];
  /** The design-system component the classes land on, if any. */
  component: string | null;
  /** Where that component is defined, when the linter can find the file. */
  componentFile: string | null;
  /** The local component that forwarded className, when one did. */
  wrapper: string | null;
  /** `className`, `classNames`, or null for a bare helper call. */
  attribute: string | null;
  node: Ast;
  /** Element names enclosing this one, nearest first — where spacing can go. */
  ancestors: string[];
};

export type Recognition = {
  componentImports?: string[];
  ignoreImports?: string[];
  mergeFunctions?: string[];
  variantFunctions?: string[];
};

type Imported = { source: string; imported: string };

export function fileOf(context: any): string {
  return context.physicalFilename ?? context.filename ?? context.getFilename?.() ?? '';
}

const regexps = new Map<string, RegExp>();

function regexpOf(pattern: string): RegExp | null {
  const cached = regexps.get(pattern);
  if (cached) return cached;
  try {
    const compiled = new RegExp(pattern);
    regexps.set(pattern, compiled);
    return compiled;
  } catch {
    return null;
  }
}

/**
 * Everything a rule needs to read a file: what each name was imported from,
 * what each local variable holds, and whether an element is a component of
 * the design system.
 */
export function createReader(context: any, options: Recognition = {}) {
  const filename = fileOf(context);
  const project = projectFor(filename);
  const program: Ast = context.sourceCode?.ast ?? context.getSourceCode?.().ast;
  const imports = new Map<string, Imported>();
  const locals = new Map<string, Ast | null>();
  const patterns = (options.componentImports ?? [])
    .map(regexpOf)
    .filter((value): value is RegExp => !!value);
  const ignored = (options.ignoreImports ?? [])
    .map(regexpOf)
    .filter((value): value is RegExp => !!value);
  const mergeFunctions = new Set([...DEFAULT_MERGE_FUNCTIONS, ...(options.mergeFunctions ?? [])]);
  const variantFunctions = new Set([
    ...DEFAULT_VARIANT_FUNCTIONS,
    ...(options.variantFunctions ?? []),
  ]);

  if (program) {
    walkAst(program, (node: Ast) => {
      if (node.type === 'ImportDeclaration') {
        for (const specifier of node.specifiers ?? []) {
          const local = specifier.local?.name;
          if (!local) continue;
          imports.set(local, {
            source: node.source?.value ?? '',
            imported: specifier.imported?.name ?? specifier.local?.name ?? '',
          });
        }
        return;
      }
      if (node.type === 'VariableDeclarator' && node.id?.type === 'Identifier') {
        const name = node.id.name;
        // A name declared twice in one file is a name the linter cannot follow.
        locals.set(name, locals.has(name) ? null : (node.init ?? null));
      }
      if (
        node.type === 'AssignmentExpression' &&
        node.left?.type === 'Identifier' &&
        locals.has(node.left.name)
      ) {
        locals.set(node.left.name, null);
      }
    });
  }

  const recognizedSource = (source: string): boolean => {
    if (!source) return false;
    if (ignored.some((pattern) => pattern.test(source))) return false;
    if (DESIGN_SYSTEM_PACKAGES.some((name) => source === name || source.startsWith(`${name}/`))) {
      return true;
    }
    if (project.uiAliases.some((alias) => source === alias || source.startsWith(`${alias}/`))) {
      return true;
    }
    if (patterns.some((pattern) => pattern.test(source))) return true;
    const resolved = resolveImport(source, filename);
    return resolved ? isComponentFile(resolved, filename) : false;
  };

  const recognizedName = (name: string): boolean => {
    const root = name.split('.')[0]!;
    const entry = imports.get(root);
    if (entry) return recognizedSource(entry.source);
    return false;
  };

  /** The component an element resolves to, with the file that defines it. */
  const resolveElement = (
    jsxName: Ast
  ): { component: string; file: string | null; wrapper: string | null } | null => {
    const display = jsxNameText(jsxName);
    const root = jsxRootName(jsxName);
    if (!root || !/^[A-Z]/.test(root)) return null;

    const entry = imports.get(root);
    if (entry) {
      if (!recognizedSource(entry.source)) return null;
      return { component: display, file: fileFor(display, root, entry), wrapper: null };
    }

    if (locals.has(root) || definedLocally(program, root)) {
      const target = wrapperTargetIn(program, root, recognizedName);
      if (!target) return null;
      const targetRoot = target.component.split('.')[0]!;
      const targetEntry = imports.get(targetRoot);
      return {
        component: target.component,
        file: targetEntry
          ? fileFor(target.component, targetRoot, targetEntry)
          : componentFileFor(target.component, filename),
        wrapper: display,
      };
    }

    return null;
  };

  const fileFor = (display: string, root: string, entry: Imported): string | null => {
    // The package index first: a package ships its source next to its build,
    // and the build has no variants left to read.
    const index = componentsFor(filename).files;
    const byName = index.get(display) ?? index.get(root) ?? index.get(entry.imported);
    if (byName) return byName;
    const resolved = resolveImport(entry.source, filename);
    return resolved && /\.(tsx|ts|jsx)$/.test(resolved) ? resolved : null;
  };

  return {
    filename,
    project,
    program,
    imports,
    locals,
    mergeFunctions,
    variantFunctions,
    recognizedSource,
    recognizedName,
    resolveElement,
  };
}

export type Reader = ReturnType<typeof createReader>;

function definedLocally(program: Ast, name: string): boolean {
  let found = false;
  walkAst(program, (node: Ast) => {
    if (found) return;
    if (node.type === 'FunctionDeclaration' && node.id?.name === name) found = true;
  });
  return found;
}

type Mode = 'classes' | 'values';

/**
 * The class text an expression carries, following one hop into a local
 * variable. `mode` says where an object keeps its classes: a merge helper puts
 * them in its keys, a variant definition in its values.
 */
export function readClasses(
  reader: Reader,
  node: Ast,
  mode: Mode,
  consumed?: WeakSet<Ast>,
  depth = 0
): { strings: ClassString[]; unreadable: Ast[] } {
  const strings: ClassString[] = [];
  const unreadable: Ast[] = [];
  /**
   * One value the linter cannot read is one finding. A template already
   * reported does not report its expressions again, and a template that sits
   * between fragments does not report once per fragment.
   */
  const reported = new Set<Ast>();
  let quiet = 0;
  const cannotRead = (found: Ast) => {
    if (quiet > 0 || reported.has(found)) return;
    reported.add(found);
    unreadable.push(found);
  };
  visit(node, mode, depth);
  return { strings, unreadable };

  function visit(current: Ast, currentMode: Mode, hops: number) {
    if (!current) return;
    switch (current.type) {
      case 'Literal':
        if (typeof current.value === 'string') strings.push({ value: current.value, node: current });
        return;
      case 'JSXExpressionContainer':
        visit(current.expression, currentMode, hops);
        return;
      case 'TemplateLiteral': {
        // A fragment touching an expression is half a class: the `text-` of
        // `text-${size}` is not a class anybody wrote, and reporting it as an
        // unknown one sends the reader looking for a typo that is not there.
        const quasis = current.quasis ?? [];
        let partial = false;
        quasis.forEach((quasi: Ast, index: number) => {
          const text = quasi.value?.cooked ?? quasi.value?.raw ?? '';
          // The empty quasi either side of `${…}` at the start or end of a
          // template is not a fragment: nothing was written there to be half of
          // a class. An empty one between two expressions is, and joins both.
          const atStart = index === 0;
          const atEnd = index === quasis.length - 1;
          const emptyEnd = text === '' && (atStart || atEnd);
          const joinsBefore = !atStart && !emptyEnd && !/^\s/.test(text);
          const joinsAfter = !atEnd && !emptyEnd && !/\s$/.test(text);
          const tokens = text.split(/\s+/).filter(Boolean);
          if (joinsBefore) tokens.shift();
          if (joinsAfter) tokens.pop();
          if (tokens.length) strings.push({ value: tokens.join(' '), node: current });
          if (joinsBefore || joinsAfter) {
            partial = true;
            cannotRead(current);
          }
        });
        // The expressions are still read, in case one holds whole classes; what
        // they cannot supply has already been said once, about the template.
        if (partial) quiet++;
        for (const expression of current.expressions ?? []) visit(expression, currentMode, hops);
        if (partial) quiet--;
        return;
      }
      case 'ConditionalExpression':
        visit(current.consequent, currentMode, hops);
        visit(current.alternate, currentMode, hops);
        return;
      case 'LogicalExpression':
        visit(current.left, currentMode, hops);
        visit(current.right, currentMode, hops);
        return;
      case 'ArrayExpression':
        for (const element of current.elements ?? []) visit(element, currentMode, hops);
        return;
      case 'ObjectExpression':
        for (const property of current.properties ?? []) {
          if (property.type === 'SpreadElement') {
            visit(property.argument, currentMode, hops);
            continue;
          }
          if (currentMode === 'classes') {
            const key = property.key;
            if (key?.type === 'Literal' && typeof key.value === 'string') {
              strings.push({ value: key.value, node: key });
            } else if (key?.type === 'Identifier' && !property.computed) {
              strings.push({ value: key.name, node: key });
            }
          } else {
            visit(property.value, currentMode, hops);
          }
        }
        return;
      case 'CallExpression': {
        const name = calleeName(current);
        if (reader.mergeFunctions.has(name)) {
          consumed?.add(current);
          for (const argument of current.arguments ?? []) visit(argument, 'classes', hops);
          return;
        }
        if (reader.variantFunctions.has(name)) {
          consumed?.add(current);
          for (const argument of current.arguments ?? []) visit(argument, 'values', hops);
          return;
        }
        cannotRead(current);
        return;
      }
      case 'Identifier': {
        if (hops >= 1) {
          cannotRead(current);
          return;
        }
        const held = reader.locals.get(current.name);
        if (held === undefined || held === null) {
          cannotRead(current);
          return;
        }
        visit(held, currentMode, hops + 1);
        return;
      }
      default:
        cannotRead(current);
    }
  }
}

function calleeName(node: Ast): string {
  const callee = node.callee;
  if (!callee) return '';
  if (callee.type === 'Identifier') return callee.name;
  if (callee.type === 'MemberExpression') return callee.property?.name ?? '';
  return '';
}

/**
 * The visitors a class rule needs. Every class attribute becomes a site, and
 * so does every helper call that is not already part of one — a `cva()` at the
 * top of a file is where its classes are written, and where an error about
 * them belongs.
 */
export function classSiteVisitors(
  context: any,
  options: Recognition,
  onSite: (site: ClassSite) => void
): Record<string, (node: Ast) => void> {
  const reader = createReader(context, options);
  const consumed = new WeakSet<Ast>();
  const elements: string[] = [];

  return {
    JSXOpeningElement(node: Ast) {
      const resolved = reader.resolveElement(node.name);
      const name = jsxNameText(node.name);

      for (const attribute of node.attributes ?? []) {
        if (attribute.type !== 'JSXAttribute') continue;
        const attributeName = attribute.name?.name;
        if (typeof attributeName !== 'string' || !isClassAttribute(attributeName)) continue;
        const value = attribute.value;
        if (!value) continue;
        const { strings, unreadable } = readClasses(reader, value, 'classes', consumed);
        onSite({
          strings,
          unreadable,
          component: resolved?.component ?? null,
          componentFile: resolved?.file ?? null,
          wrapper: resolved?.wrapper ?? null,
          attribute: attributeName,
          node: attribute,
          ancestors: [...elements].reverse(),
        });
      }

      if (name) elements.push(name);
    },

    'JSXOpeningElement:exit'(node: Ast) {
      if (jsxNameText(node.name)) elements.pop();
    },

    CallExpression(node: Ast) {
      if (consumed.has(node)) return;
      const name = calleeName(node);
      const mode: Mode | null = reader.mergeFunctions.has(name)
        ? 'classes'
        : reader.variantFunctions.has(name)
          ? 'values'
          : null;
      if (!mode) return;
      const { strings, unreadable } = readClasses(reader, node, mode, consumed);
      onSite({
        strings,
        unreadable,
        component: null,
        componentFile: null,
        wrapper: null,
        attribute: null,
        node,
        ancestors: [...elements].reverse(),
      });
    },
  };
}
