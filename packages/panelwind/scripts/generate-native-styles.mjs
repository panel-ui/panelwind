/**
 * Writes src/native/style-props.generated.json: what a style can contain once
 * it reaches React Native.
 *
 * Both halves are read from installed source rather than typed out. The
 * properties and their keyword values come from React Native's own style
 * types, so the answer moves when React Native moves; the rewrites and the
 * two properties that are deliberately thrown away come from Uniwind's CSS to
 * React Native converter. A table written by hand would be a guess that looks
 * like a fact, and the rule built on it would give confident wrong answers.
 *
 * Run: npm run native:generate --workspace=panelwind
 */
import { createRequire } from 'node:module';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const output = path.join(here, '..', 'src', 'native', 'style-props.generated.json');

const STYLE_INTERFACES = [
  'FlexStyle',
  'ShadowStyleIOS',
  'TransformsStyle',
  'ViewStyle',
  'TextStyleIOS',
  'TextStyleAndroid',
  'TextStyle',
  'ImageStyle',
];

function fail(message) {
  console.error(`generate-native-styles: ${message}`);
  process.exit(1);
}

function parse(file) {
  const source = fs.readFileSync(file, 'utf8');
  return ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

function reactNativeStyles() {
  const manifest = require.resolve('react-native/package.json');
  const root = path.dirname(manifest);
  const version = JSON.parse(fs.readFileSync(manifest, 'utf8')).version;
  const file = path.join(root, 'Libraries', 'StyleSheet', 'StyleSheetTypes.d.ts');
  if (!fs.existsSync(file)) fail(`React Native's style types are not at ${file}.`);

  const sourceFile = parse(file);
  const properties = new Set();
  /** Properties whose type is a union of string keywords, and those keywords. */
  const values = {};

  const visit = (node) => {
    if (ts.isInterfaceDeclaration(node) && STYLE_INTERFACES.includes(node.name.text)) {
      for (const member of node.members) {
        if (!ts.isPropertySignature(member) || !member.name) continue;
        const name = member.name.getText(sourceFile).replace(/['"]/g, '');
        properties.add(name);
        const keywords = keywordsOf(member.type, sourceFile);
        if (keywords) {
          values[name] = [...new Set([...(values[name] ?? []), ...keywords])].sort();
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  if (properties.size < 100) fail(`only ${properties.size} style properties were found; the type layout has moved.`);
  return { version, properties: [...properties].sort(), values };
}

/**
 * A union of string literals gives the keywords a property accepts. A union
 * carrying anything else — a number, a named type — means the property takes
 * more than keywords, and no keyword check can be made from it.
 */
function keywordsOf(type, sourceFile) {
  if (!type || !ts.isUnionTypeNode(type)) return null;
  const keywords = [];
  for (const member of type.types) {
    if (member.kind === ts.SyntaxKind.UndefinedKeyword) continue;
    if (ts.isLiteralTypeNode(member) && ts.isStringLiteral(member.literal)) {
      keywords.push(member.literal.text);
      continue;
    }
    return null;
  }
  return keywords.length ? keywords : null;
}

function uniwindConversion() {
  let root;
  try {
    root = path.dirname(require.resolve('uniwind/package.json'));
  } catch {
    fail('uniwind is not installed; the conversion table cannot be read.');
  }
  const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
  const file = path.join(root, 'src', 'bundler', 'css-processor', 'rn.ts');
  if (!fs.existsSync(file)) fail(`Uniwind's converter is not at ${file}.`);

  const sourceFile = parse(file);
  const rewritten = [];
  const dropped = [];

  const visit = (node) => {
    if (
      ts.isVariableDeclaration(node) &&
      node.name.getText(sourceFile) === 'cssToRNMap' &&
      node.initializer &&
      ts.isObjectLiteralExpression(node.initializer)
    ) {
      for (const property of node.initializer.properties) {
        if (!ts.isPropertyAssignment(property)) continue;
        const name = property.name.getText(sourceFile).replace(/['"]/g, '');
        (returnsNothing(property.initializer) ? dropped : rewritten).push(name);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  if (!rewritten.length) fail('no entries were found in the converter; its shape has moved.');
  return { version, rewritten: rewritten.sort(), dropped: dropped.sort() };
}

/** `backdropFilter: () => ({})` — a property Uniwind maps to no style at all. */
function returnsNothing(initializer) {
  if (!ts.isArrowFunction(initializer)) return false;
  const body = initializer.body;
  if (ts.isParenthesizedExpression(body) && ts.isObjectLiteralExpression(body.expression)) {
    return body.expression.properties.length === 0;
  }
  return false;
}

const reactNative = reactNativeStyles();
const uniwind = uniwindConversion();

const table = {
  '//': 'Generated by scripts/generate-native-styles.mjs. Do not edit.',
  reactNative: reactNative.version,
  uniwind: uniwind.version,
  properties: reactNative.properties,
  keywords: reactNative.values,
  rewritten: uniwind.rewritten,
  dropped: uniwind.dropped,
};

fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${JSON.stringify(table, null, 2)}\n`);
console.log(
  `style-props.generated.json: ${table.properties.length} properties from react-native ${table.reactNative}, ` +
    `${table.rewritten.length} rewrites and ${table.dropped.length} dropped from uniwind ${table.uniwind}`
);
