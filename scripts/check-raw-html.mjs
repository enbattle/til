#!/usr/bin/env node
// Guardrail for docs/NON_NEGOTIABLES.md #6: markdown never renders raw HTML,
// and `dangerouslySetInnerHTML` only takes output from an escaping source.
// Fails if a dependency that turns on raw HTML in markdown is installed, if
// app code outside the one component allowed to use it (CodeBlock.tsx, which
// passes it Shiki's escaped output) references the name
// `dangerouslySetInnerHTML` at all (a JSX attribute, an object key, a member
// property, static or computed, or a string or static template literal;
// comments don't count), or if app code references another DOM sink
// (innerHTML and friends, insertAdjacentHTML, document.write).
//
// Each app file is parsed with oxc-parser and the sink check walks the syntax
// tree (docs/specs/raw-html-ast.md), so comments, strings, spacing, `?.`, `!`,
// casts and parentheses don't change what matches. A file that doesn't parse
// is itself a violation: the check can't vouch for code it can't read. The
// walk still can't follow values, so by design it does not catch
// (docs/specs/raw-html-ast.md, "Unchanged"):
//   - a sink reached through a value (`pick(document, 'write')(s)`);
//   - names built by string concatenation (`'dangerously' + 'SetInnerHTML'`);
//   - `Object.assign(el, { innerHTML: s })` and
//     `Reflect.set(el, 'innerHTML', s)`;
//   - computed keys from variables (`el[key] = s`);
//   - call-return receivers (`getDocument().write(s)`,
//     `document.open().write(s)`);
//   - `Object.defineProperty(el, 'innerHTML', …)`;
//   - prop spreads of variables (`<iframe {...props} />`) and conditional
//     spreads (`<iframe {...(c ? { srcDoc: s } : {})} />`);
//   - casts to a type other than a plain reference (`x as Document | null`,
//     `x as Readonly<Document>`) on a `.write` receiver;
//   - array and `for…of` sources of a destructured `write`
//     (`const [{ write }] = [document]`,
//     `for (const { write } of [document])`);
//   - destructured function and `catch` parameters with no default
//     (`({ insertAdjacentHTML }: HTMLElement) => …`, `catch ({ document: { write } })`).
// A type-only mention of `dangerouslySetInnerHTML` (`type P = {
// dangerouslySetInnerHTML?: X }`) is flagged too: a false positive that fails
// closed.
// JSX in a .js or .mjs file is a parse error, so such a file fails as
// unparseable rather than being checked.
// `eval` and `new Function` are script sinks, not HTML ones, and are out of
// scope here.
import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parseSync } from 'oxc-parser';
import { listFiles, ROOT as REPO_ROOT } from './lib.mjs';

const ROOT = process.env.CHECK_RAW_HTML_ROOT ?? REPO_ROOT;
const RAW_HTML_PACKAGES = ['rehype-raw', 'rehype-dom-raw'];
const ALLOWED = new Set(['src/components/CodeBlock.tsx']);

// DOM APIs that parse a string as HTML; none is needed anywhere in this app.
// Properties whose assignment parses HTML (rows A1, A2).
const HTML_PROPS = new Set(['innerHTML', 'outerHTML', 'srcdoc']);
// Methods that parse their string argument as HTML (row C1).
const HTML_METHODS = new Set([
  'insertAdjacentHTML',
  'setHTMLUnsafe',
  'parseHTMLUnsafe',
  'createContextualFragment',
]);
// Wrappers that don't change which object or property an expression names.
const WRAPPERS = new Set([
  'ParenthesizedExpression',
  'TSNonNullExpression',
  'TSAsExpression',
  'TSSatisfiesExpression',
  'TSTypeAssertion',
  'ChainExpression',
]);
const CASTS = new Set(['TSAsExpression', 'TSSatisfiesExpression', 'TSTypeAssertion']);
const DOCUMENT_NAME = /[dD]ocument$/;

/** `node` with parens, `!`, casts, `?.` and leading comma operands peeled off. */
function unwrap(node) {
  for (;;) {
    if (node && WRAPPERS.has(node.type)) node = node.expression;
    else if (node?.type === 'SequenceExpression') node = node.expressions.at(-1);
    else return node;
  }
}

/** A string literal's or expression-free template literal's value, else null. */
function staticString(node) {
  node = unwrap(node);
  if (node?.type === 'Literal' && typeof node.value === 'string') return node.value;
  if (node?.type === 'TemplateLiteral' && node.expressions.length === 0) {
    return node.quasis[0].value.cooked;
  }
  return null;
}

/** The name of a member's property or an object property's key, else null. */
function keyName(key, computed) {
  if (!computed && key.type === 'Identifier') return key.name;
  return staticString(key);
}
function memberName(node) {
  node = unwrap(node);
  return node?.type === 'MemberExpression' ? keyName(node.property, node.computed) : null;
}

/** True for a type reference named `Document` or ending in `Document`. */
function isDocumentType(type) {
  if (type?.type !== 'TSTypeReference') return false;
  const name = type.typeName;
  const text = name.type === 'TSQualifiedName' ? name.right.name : name.name;
  return DOCUMENT_NAME.test(text ?? '');
}

/** A `document`-like receiver for `.write`/`.writeln` (row C2). */
function isDocumentLike(node) {
  for (;;) {
    if (node && WRAPPERS.has(node.type)) {
      if (CASTS.has(node.type) && isDocumentType(node.typeAnnotation)) return true;
      node = node.expression;
    } else if (node?.type === 'SequenceExpression') {
      node = node.expressions.at(-1);
    } else break;
  }
  if (node?.type === 'Identifier') return DOCUMENT_NAME.test(node.name);
  return DOCUMENT_NAME.test(memberName(node) ?? '');
}

/** Every member expression an assignment target writes to, through patterns. */
function* assignedMembers(target) {
  target = unwrap(target);
  if (!target) return;
  switch (target.type) {
    case 'MemberExpression':
      yield target;
      break;
    case 'ArrayPattern':
      for (const element of target.elements) yield* assignedMembers(element);
      break;
    case 'ObjectPattern':
      for (const property of target.properties) {
        yield* assignedMembers(
          property.type === 'RestElement' ? property : property.value,
        );
      }
      break;
    case 'RestElement':
      yield* assignedMembers(target.argument);
      break;
    case 'AssignmentPattern':
      yield* assignedMembers(target.left);
      break;
  }
}

/** The sink methods an object pattern takes out of `source` by key, not by
 * local alias, at any nesting depth: any HTML_METHODS key, or `write`/`writeln`
 * from a `document`-like source (`const { write } = document`). In a nested
 * pattern the source is the parent property, so it's `document`-like when that
 * key is (`const { contentDocument: { write } } = iframe`). */
function* destructuredSinks(pattern, source, documentLike = isDocumentLike(source)) {
  pattern = unwrap(pattern);
  if (pattern?.type !== 'ObjectPattern') return;
  for (const property of pattern.properties) {
    if (property.type === 'RestElement') continue;
    const key = keyName(property.key, property.computed);
    if (HTML_METHODS.has(key)) yield `.${key}`;
    if ((key === 'write' || key === 'writeln') && documentLike) {
      yield `document.${key}`;
    }
    let value = unwrap(property.value);
    if (value?.type === 'AssignmentPattern') value = unwrap(value.left);
    if (value?.type === 'ObjectPattern') {
      yield* destructuredSinks(value, null, DOCUMENT_NAME.test(key ?? ''));
    }
  }
}

/** The sink names one node writes raw HTML through (rows A1–J2). */
function* sinksAt(node) {
  switch (node.type) {
    case 'VariableDeclarator':
      yield* destructuredSinks(node.id, node.init);
      break;
    case 'AssignmentPattern':
      yield* destructuredSinks(node.left, node.right);
      break;
    case 'AssignmentExpression':
      yield* destructuredSinks(node.left, node.right);
    // falls through
    case 'ForOfStatement':
    case 'ForInStatement':
      for (const member of assignedMembers(node.left)) {
        const name = memberName(member);
        if (HTML_PROPS.has(name)) yield `.${name}`;
      }
      break;
    // Any reference to a sink method, not only a direct call's callee: tagged
    // templates, `.call`/`.apply`/`.bind` and method references (rows C1, C2).
    case 'MemberExpression': {
      const name = memberName(node);
      if (HTML_METHODS.has(name)) yield `.${name}`;
      if ((name === 'write' || name === 'writeln') && isDocumentLike(node.object)) {
        yield `document.${name}`;
      }
      break;
    }
    case 'CallExpression': {
      const name = memberName(node.callee);
      const attribute =
        name === 'setAttribute'
          ? node.arguments[0]
          : name === 'setAttributeNS'
            ? node.arguments[1]
            : undefined;
      if (attribute && staticString(attribute)?.toLowerCase() === 'srcdoc') {
        yield `${name}('srcdoc')`;
      }
      break;
    }
    case 'JSXAttribute':
      if (
        node.name.type === 'JSXIdentifier' &&
        node.name.name.toLowerCase() === 'srcdoc'
      ) {
        yield `JSX ${node.name.name}`;
      }
      break;
    case 'JSXSpreadAttribute': {
      const spread = unwrap(node.argument);
      if (spread?.type !== 'ObjectExpression') break;
      for (const property of spread.properties) {
        if (property.type !== 'Property') continue;
        const key = keyName(property.key, property.computed);
        if (key?.toLowerCase() === 'srcdoc' || key === 'dangerouslySetInnerHTML') {
          yield `JSX spread ${key}`;
        }
      }
      break;
    }
  }
}

/** True for any reference to the name `dangerouslySetInnerHTML` (row D1): an
 * identifier (a member property, object key or binding), a JSX attribute, or
 * a string or static template literal. Comments aren't nodes, so they pass. */
function isDangerousKey(node) {
  if (node.type === 'Identifier' || node.type === 'JSXIdentifier') {
    return node.name === 'dangerouslySetInnerHTML';
  }
  if (node.type === 'Literal' || node.type === 'TemplateLiteral') {
    return staticString(node) === 'dangerouslySetInnerHTML';
  }
  return false;
}

/** Visits every node in the tree, through every object and array child. */
function walk(node, visit) {
  visit(node);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) {
      for (const child of value) {
        if (child && typeof child.type === 'string') walk(child, visit);
      }
    } else if (value && typeof value.type === 'string') {
      walk(value, visit);
    }
  }
}

const violations = [];

const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
for (const field of ['dependencies', 'devDependencies']) {
  for (const name of RAW_HTML_PACKAGES) {
    if (pkg[field]?.[name])
      violations.push(`package.json ${field}: ${name} renders raw HTML`);
  }
}

const appFiles = listFiles({
  root: ROOT,
  under: 'src',
  // `.mjs` too: src/lib/markdown.mjs ships to the browser.
  ext: ['.js', '.jsx', '.mjs', '.ts', '.tsx'],
}).filter((path) => !/\.(test|spec)\.[cm]?[jt]sx?$/.test(path));
for (const path of appFiles) {
  const rel = relative(ROOT, path).split('\\').join('/');
  const { program, errors } = parseSync(path, readFileSync(path, 'utf8'));
  if (errors.length > 0) {
    violations.push(
      `${rel}: could not be parsed (${errors[0].message}) — check:raw-html can't vouch for it`,
    );
    continue;
  }
  const found = new Set();
  let dangerous = false;
  walk(program, (node) => {
    for (const sink of sinksAt(node)) found.add(sink);
    if (isDangerousKey(node)) dangerous = true;
  });
  if (dangerous && !ALLOWED.has(rel)) {
    violations.push(`${rel}: dangerouslySetInnerHTML outside ${[...ALLOWED].join(', ')}`);
  }
  for (const sink of found) violations.push(`${rel}: ${sink} writes raw HTML`);
}

if (violations.length > 0) {
  console.error('Raw HTML rendering found (docs/NON_NEGOTIABLES.md #6):\n');
  for (const violation of violations) console.error(`  ${violation}`);
  process.exit(1);
}
console.log('No raw HTML rendering outside CodeBlock.tsx.');
