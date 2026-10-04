# Spec: check-raw-html on a parser (oxc-parser)

Status: approved 2026-10-04.

Setup, before Stage 2: the orchestrator ran
`npm install --save-dev oxc-parser@^0.152.0` (0.152.0 installed). That way
the Stage 2 parse assertion can import it without making its file fail to
load as a whole. `npm audit`: 0 vulnerabilities. A smoke test parsed TSX with
a cast and `??=` with no errors. Stage 3 doesn't install it again.

## Context

`scripts/check-raw-html.mjs` enforces NON_NEGOTIABLES #6's promise that app
code never writes raw HTML (`innerHTML`, `outerHTML`, `insertAdjacentHTML`,
`document.write` and friends). It does that with seven regexes. #63 needed
three fix rounds because a regex sees text, and each new spelling of the same
operation slipped past: `?.`, `!`, casts, case, `setAttribute`. Its header
still lists forms it can't catch, and it has false positives: a `srcDoc`
variable or default value, and sinks named inside comments or strings.

#63's retro added a Stage 1 rule: a guard over source code matches parsed
syntax (an AST), not a regex. The user chose `oxc-parser` for this:

| Check        | Result                                                             |
| ------------ | ------------------------------------------------------------------ |
| Version      | 0.152.0                                                            |
| License      | MIT                                                                |
| Source       | the `oxc-project/oxc` repository, the same one `oxlint` comes from |
| Node support | `^20.19.0 \|\| >=22.12.0`, which covers this repo's engines        |
| Dependencies | one direct dependency plus a prebuilt binary per platform          |

This rewrite replaces the regexes with an AST walk. The locked tests from #62
and #63 are the behavior contract.

## Design

**Parsing.** Each scanned app file (unchanged scope: `.js`, `.jsx`, `.mjs`,
`.ts` and `.tsx` under `src/`, test files excluded) is parsed with
`parseSync(path, source)`. The filename sets the language. Comments and string
contents are no longer part of the match.

**A file that fails to parse is a violation.** It's reported as
`<file>: could not be parsed (<first error>) — check:raw-html can't vouch for
it`. Unparseable code could hide a sink, and the real app always parses,
because `tsc` and the build already require it.

**Unwrapping.** Before any test, an expression is unwrapped through:

- parentheses;
- `TSNonNullExpression` (`x!`, any number of times);
- `TSAsExpression`, `TSSatisfiesExpression` and `TSTypeAssertion` (`<T>x`);
- `ChainExpression` (`?.`).

The same applies to callee, object and assignment targets.

**Property name.** A member's name is its identifier (`el.innerHTML`), or a
string literal or expression-free template literal in brackets
(`el['innerHTML']`, ``el[`innerHTML`]``). Computed keys from variables have no
name, which is a known limit.

**What's rejected.** Every message names the sink, using the same names the
locked tests look for.

| #   | AST shape                                                                                                                           | Names                                 |
| --- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| A1  | assignment of any operator (`=`, `+=`, `\|\|=`, `&&=`, `??=` …) whose target is a member named `innerHTML`, `outerHTML` or `srcdoc` | the property                          |
| A2  | the same member as a destructuring or `for…of` assignment target (`[el.innerHTML] = [s]`, `({ h: el.innerHTML } = o)`)              | the property                          |
| C1  | call whose callee is a member named `insertAdjacentHTML`, `setHTMLUnsafe`, `parseHTMLUnsafe` or `createContextualFragment`          | the method                            |
| C2  | call whose callee is a member named `write` or `writeln` on a document-like receiver (below)                                        | `document.write` / `document.writeln` |
| C3  | `setAttribute(name, …)` or `setAttributeNS(ns, name, …)` whose name is the string `srcdoc` (any case)                               | `srcdoc`                              |
| J1  | JSX attribute named `srcdoc` (any case) on any element                                                                              | `srcdoc`                              |
| J2  | `srcdoc`/`srcDoc` or `dangerouslySetInnerHTML` as a key in an object spread into JSX (`{...{ srcDoc: s }}`)                         | the key                               |
| D1  | `dangerouslySetInnerHTML` as a JSX attribute or object property key in a file other than `src/components/CodeBlock.tsx`             | `dangerouslySetInnerHTML`             |

**Document-like receiver** (C2), after unwrapping, is one of:

- an identifier or member whose name ends in `document`/`Document` (`document`,
  `contentDocument`, `ownerDocument`, `_document`, `win.document`);
- an expression cast to a type named `Document` or ending in `Document`
  (`(x as Document)`, `<Document>x`).

`(stream as Writable).write` and `doc.write` don't qualify.

**Unchanged:**

- the package check (`rehype-raw`, `rehype-dom-raw`);
- the `CodeBlock.tsx` allowlist;
- the file scope;
- the exit code and the stderr shape (`<file>: <sink> writes raw HTML`);
- the header, which keeps documenting the remaining known limits:
  - aliasing (`const w = document.write; w(s)`);
  - `Object.assign` and `Reflect.set`;
  - computed keys from variables;
  - call-return receivers (`getDocument().write()`);
  - prop spreads of variables (`{...props}`).

## Acceptance criteria

1. All existing tests in `scripts/check-raw-html.test.mjs` pass: the #6 span
   allowlist, the sinks, the variants and the near-misses.
   - Stage 2 may rewrite a fixture that isn't a valid program into one that is,
     with the same intent; e.g. a bare `dangerouslySetInnerHTML={{}}` becomes
     `<div dangerouslySetInnerHTML={{ __html: s }} />`.
   - Every fixture must parse, and a test asserts it.
2. **Newly caught**, each a planted case that must exit 1 naming the sink:
   - `el.innerHTML /* c */ = s`;
   - `[el.innerHTML] = [s]`;
   - `({ h: el.outerHTML } = o)`;
   - `document['write'](s)`;
   - `(<Document>x).write(s)` in a `.ts` file;
   - `doc!!.write(s)`, where `doc` is document-like (e.g. `iframeDocument!!`);
   - `setAttributeNS(null, 'srcdoc', s)`;
   - `<iframe {...{ srcDoc: s }} />`.
3. **No longer flagged**, each a planted case that must exit 0:
   - `const srcDoc = x`;
   - `function f(srcDoc = '') {}`;
   - `const { srcDoc = '' } = p`;
   - `// el.innerHTML = s`;
   - `const t = 'el.innerHTML = s'`;
   - a template literal containing `document.write(s)`;
   - `type P = { srcDoc?: string }`.
4. A file with a syntax error exits 1, with a stderr line naming the file and
   "could not be parsed".
5. The real-repository test passes, and `npm run check:raw-html` runs in under
   about 3s.
6. **Mutation gate (orchestrator):** disabling each row A1–D1, the unwrapping
   of `!`, casts, `?.` and parens, and the parse-error rule each fails at least
   one test.
7. `oxc-parser` is a devDependency at `^0.152.0`. `npm audit` reports no high
   or critical advisories, and the result is recorded in the spec's As built.

## Scope

In:

- `scripts/check-raw-html.mjs`, rewritten;
- `scripts/check-raw-html.test.mjs` (Stage 2: the new cases, fixtures made
  valid, the parse assertion);
- `package.json` / `package-lock.json`, the devDependency;
- docs only if a doc describes the regex approach.

Out:

- other guards;
- NON_NEGOTIABLES text;
- data-flow analysis.

User-facing UI: none.

## Non-negotiables check

- #6: the same promise, enforced more completely, with the text unchanged.
- #7: no runtime script, since this is a devDependency used only by a check.
- Nothing conflicts.

## Verification

- Stage 2 gate:
  - the new A2, C2 and J2 cases and parse-error tests are red;
  - the existing ones are green on the regex version (the AST must keep
    them green);
  - the fixtures parse.
- Stage 3: `check:test-lock -- --verify`, `npm run verify` and `npm audit`.
- Orchestrator mutation gate: criterion 6.
- Stage 4: the reviewer tries further real-world forms in a copy.

## As built

- **Walk.** `scripts/check-raw-html.mjs` walks every node, through every object
  and array child with a `type`, so no node type is skipped.
  - Rows A1–J2 are in `sinksAt()`; D1 is `isDangerousKey()`.
  - Assignment targets are followed through array and object patterns, rest
    elements and defaults (`assignedMembers()`).
- **Messages.** Each stderr line names the sink:
  - `.innerHTML`, `.outerHTML`, `.srcdoc` and the methods;
  - `document.write` / `document.writeln`;
  - `setAttribute('srcdoc')` / `setAttributeNS('srcdoc')`;
  - `JSX srcdoc` / `JSX srcDoc`, and `JSX spread <key>`.

  A file reports each sink once.

- **Runtime.** `npm run check:raw-html` runs in about 0.5s on the real repo.
- **Tests.** Stage 2 rewrote two fixtures that didn't parse (the bare
  `dangerouslySetInnerHTML={{}}` and the CodeBlock allowlist fixture) as JSX,
  with the same intent. A parse assertion covers every fixture. That made 151
  tests at Stage 3, and 179 after fix round 1.
- **Mutation gate.** The first pass caught 16 of 17. Removing the
  `ChainExpression` unwrap was missed: the walk visits the call inside an
  optional chain, so unwrapping matters only for a parenthesized chain used as
  a receiver.
  - A Stage 2 re-run added `(iframe?.contentDocument).write(html)`,
    `(frame?.contentWindow?.document).writeln(html)` and
    `(el?.firstElementChild).innerHTML = s`.
  - The two write cases kill that mutant. The second pass caught all 17.
- **Docs.** `docs/verification.md` gains a short paragraph on the parser and
  the parse-error rule.

## Review decisions

- **Round 1, fix with a test** (all confirmed by triage):
  - `dangerouslySetInnerHTML` coverage had narrowed, a regression in #6's guard.
    Any reference to the name outside `CodeBlock.tsx` is now flagged: a member
    (`props.dangerouslySetInnerHTML`, `p['dangerouslySetInnerHTML']`), a
    string or static template literal, or a key. Comments aren't. The header's
    "appears in app code" wording is corrected to match.
  - `(0, document).write(s)` (introduced): the unwrap steps into a
    `SequenceExpression`'s last expression.
  - Already missed by the regex, but cheap in this rewrite, so fixed here:
    - a tagged template ``document.write`…` ``;
    - `.call`/`.apply` on a sink method;
    - method references (`const f = el.insertAdjacentHTML`).

    Rows C1/C2 now match any reference to a sink method on its receiver, not
    only a direct call. Feature detection (`if (el.insertAdjacentHTML)`) is
    flagged too; that's accepted.
- **Known limitation, theoretical, listed in the header:**
  - conditional spreads (`{...(c ? { srcDoc: s } : {})}`);
  - cast types other than a plain reference (`Document | null`,
    `Readonly<Document>`);
  - a call-return receiver (`document.open().write(s)`);
  - `Object.defineProperty(el, 'innerHTML', …)`;
  - JSX in `.js`/`.mjs` is a parse error, as Vite would reject it anyway.
- **Round 2, fix with a test** (pre-existing, but reachable and cheap here):
  destructured sink methods, i.e. `const { write } = document`,
  `const { writeln: w } = iframe.contentDocument` and
  `const { insertAdjacentHTML: f } = el`. An object pattern taking a C1 method
  name from anything, or `write`/`writeln` from a document-like source, is
  flagged.
  - The header's aliasing example, `const w = document.write`, has been caught
    since round 1, so the header's remaining aliasing limit is a call through
    a value, e.g. `pick(document, 'write')`.
- **Round 3** (the user authorized it past the cap of 2 on 2026-10-04):
  nested destructuring, e.g. `const { contentDocument: { write } } = iframe` or
  `const { document: { write } } = window`.
  - The fix recurses into nested object patterns. A parent key whose name
    ends in `document`/`Document` counts as a document-like source, and
    HTML_METHODS keys count at any depth.
  - Array and `for…of` sources (`const [{ write }] = [document]`) are
    theoretical, so they're listed in the header instead.
- **Known limitation, theoretical, found in the round-3 re-review:**
  destructured function and `catch` parameters with no default
  (`({ insertAdjacentHTML }: HTMLElement) => …`, `function f({ write }: Document)`,
  `catch ({ document: { write } })`) aren't checked. An unbound DOM method also
  throws "Illegal invocation" unless called through `.call`. The script header
  doesn't list this yet; add it the next time the header is edited.
- **Known limitation, a false positive that fails closed:** type-only mentions
  of `dangerouslySetInnerHTML` are flagged (`Omit<…, 'dangerouslySetInnerHTML'>`),
  as main's text match did too. Rename around it, or keep such types in
  `CodeBlock.tsx`.
- **Known limitation, theoretical:** string concatenation
  (`'dangerously' + 'SetInnerHTML'`, `el['insertAdjacent' + 'HTML']`).
- **Info:** a 10k-deep expression overflows the walk or the native parser's
  stack. Either way it exits non-zero, so it fails closed.
