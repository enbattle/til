# Spec: close check-raw-html's missed HTML-writing forms

Status: approved 2026-10-04.

## Context

NON_NEGOTIABLES #6 promises that `check:raw-html` rejects `innerHTML`,
`outerHTML`, `insertAdjacentHTML` and `document.write` in app code. Its regex,
`/\.(innerHTML|outerHTML)\s*=|\.insertAdjacentHTML\s*\(|document\.write(ln)?\s*\(/`
in `scripts/check-raw-html.mjs`, only catches a plain `.prop =`.

The #62 review found real forms it misses:

- `el.innerHTML += s` (compound assignment);
- bracket access, `el["innerHTML"] = s`;
- the HTML-parsing sinks `setHTMLUnsafe`, `Document.parseHTMLUnsafe`,
  `Range.createContextualFragment`, and an iframe's `srcdoc`.

All are OWASP DOM-XSS sinks. The regex also wrongly matches `el.innerHTML ==
x`, a read, because `\s*=` matches the first `=` of `==`.

No app code uses any of these today. The only mentions are in
`src/content/security/xss.md`, which isn't scanned. This change closes the
gap before one lands.

**Guard type.** This is a blocklist lint over known sinks, a kind #6 excludes
from its allowlist rule, and its input (arbitrary source code) can't be listed
in full. So, per Stage 1's guard bullet, this spec lists the vectors it must
reject and the near-misses it must pass, including each sink's variant forms.

## Design

Only `scripts/check-raw-html.mjs` changes: its sink detection. The package
check, the `dangerouslySetInnerHTML` allowlist, the file scope and the exit
behavior are unchanged.

**Must reject.** Each is a planted case that must exit 1, with stderr naming
the form:

| #   | Form                           | Example                                                                                   |
| --- | ------------------------------ | ----------------------------------------------------------------------------------------- |
| R1  | property assignment            | `el.innerHTML = s`, `el.outerHTML = s` (existing)                                         |
| R2  | compound assignment            | `el.innerHTML += s`; `\|\|=`, `&&=`, `??=`                                                |
| R3  | assignment across a line break | `el.innerHTML\n  = s`                                                                     |
| R4  | bracket access, any quote      | `el['innerHTML'] = s`, `el["outerHTML"] += s`, ``el[`innerHTML`] = s``                    |
| R5  | method sinks (existing)        | `insertAdjacentHTML(`, `document.write(`, `document.writeln(`                             |
| R6  | HTML-parsing methods           | `el.setHTMLUnsafe(s)`, `Document.parseHTMLUnsafe(s)`, `range.createContextualFragment(s)` |
| R7  | iframe `srcdoc`                | `frame.srcdoc = s`, `frame['srcdoc'] = s`, and the React prop `<iframe srcDoc={s} />`     |

**Must pass.** Each is a planted case that must exit 0:

| #   | Form                              | Example                                                                             |
| --- | --------------------------------- | ----------------------------------------------------------------------------------- |
| P1  | reads                             | `const x = el.innerHTML;`, `return el.outerHTML`                                    |
| P2  | comparisons                       | `el.innerHTML === ''`, `el.innerHTML == y`, `el.innerHTML !== y`, `el.srcdoc === s` |
| P3  | longer identifiers                | `el.innerHTMLCache = s`, `obj.srcdocs = s`                                          |
| P4  | safe text sinks                   | `el.textContent = s`, `el.innerText = s`                                            |
| P5  | the bare word in prose or strings | `'innerHTML'`, `// avoid innerHTML`                                                 |

The existing real-repository test must still pass.

**Known limits (not caught, by design).** A text lint can't follow values, so
these stay out of scope and are listed in the guard's comment:

- `Object.assign(el, { innerHTML: s })`;
- computed keys (`el[key] = s`);
- `Reflect.set`;
- aliasing (`const w = document.write; w(s)`).

`eval` and `new Function` are script sinks, not HTML ones, and are a separate
concern.

**NON_NEGOTIABLES #6 is unchanged.** Its named sinks stay as they are. The new
forms are script-only additions, tested through the existing
`SCRIPT_ONLY_SINKS` mechanism in `scripts/check-raw-html.test.mjs`. That keeps
#62's span allowlist exact.

## Acceptance criteria

1. Every R row is a planted case: exit 1, with a stderr line naming the sink or
   prop (e.g. `innerHTML`, `srcdoc`/`srcDoc`, `setHTMLUnsafe`).
2. Every P row is a planted case that exits 0.
3. The existing tests pass unchanged: the #6 span allowlist, the per-sink
   plants and the real-repository run.
4. **Mutation gate (orchestrator):** removing any one R row's handling from the
   script fails a test, and making the assignment pattern also match `==`
   fails a P2 test.
5. The guard's header comment lists what it doesn't catch (the known limits).

## Scope

In:

- `scripts/check-raw-html.mjs`, the sink detection and its comment;
- `scripts/check-raw-html.test.mjs`, the new tables, written by the Stage 2
  test-writer.

Docs: none expected beyond the script comment. #6 is unchanged.

Out:

- `eval`/`new Function`;
- data-flow analysis;
- other guards;
- NON_NEGOTIABLES text.

User-facing UI: none.

## Non-negotiables check

- #6: strengthens enforcement of what it promises, with no text change.
- Nothing conflicts.

## As built

- Five named patterns in `RAW_HTML_SINKS`:
  - `propertyWrite`;
  - `bracketWrite`;
  - `htmlMethod`;
  - `documentWrite`;
  - `reactSrcDoc`.
- The assignment pattern is `\s*(?:\+|\|\||&&|\?\?)?=(?![=>])`, so `==`,
  `===` and `=>` don't match.
- The script now reports the first match of each family in a file, not only
  the first match overall. Matched text has its whitespace collapsed onto one
  stderr line.
- R3 and `!==` (P2) were already handled by the old regex, so their tests
  guard against regressions; they weren't red at Stage 2.
- Looseness: `reactSrcDoc` (`/\bsrcDoc\s*=(?![=>])/`) also matches a plain
  variable assignment such as `const srcDoc = …`. That's a false positive the
  author can rename around. Nothing in the repo does this.
- Orchestrator mutation gate: 11 of 11 caught.
  - R2 compound operators, R3 newline, R4 bracket access, R5
    insertAdjacentHTML and writeln, R6 each of the three methods, R7 the
    `srcdoc` property and React `srcDoc`.
  - P2: letting `==` through flags it.

## Review decisions

- Round 1, fix with a test (reachable vectors the guard missed):
  - lowercase JSX `<iframe srcdoc={s}>`, which React 19 renders to the
    attribute;
  - `setAttribute('srcdoc', s)`;
  - `contentDocument.write(s)` and `ownerDocument.write(s)`;
  - `_document.write(s)`, a regression from the new `\b`.
- Round 1 patterns:
  - `reactSrcDoc` became the case-insensitive `jsxSrcdoc`,
    `/(?<![.\w$])srcdoc\s*=(?![=>])/i`;
  - new `setAttributeSrcdoc`, `/\.setAttribute\s*\(\s*(['"\x60])srcdoc\1/i`;
  - `documentWrite` became `/(?<![\w$])[\w$]*[dD]ocument\.write(?:ln)?\s*\(/`.

  That makes seven named patterns, not the five listed under As built.

- Round 2, fix with a test: `iframe.contentDocument?.write(html)` is
  reachable, since TypeScript types `contentDocument` as nullable. The fix also
  allows `?.` and a line break before `.write`.
- Round 3 (user-authorized past the cap of 2, on 2026-10-04):
  - `contentDocument!.write(...)` and `(x as Document).write(...)` were
    missed. Both are realistic TypeScript forms of a `document.write` NON_NEGOTIABLES #6
    promises to reject.
  - Folded into the same round: the message-builder comment's wrong example,
    and documenting that only `documentWrite` allows whitespace after the dot.
- Round 3 result: documentWrite is
  `/(?<![\w$])[\w$]*[dD]ocument!?\)?\s*\??\.\s*write(?:ln)?\s*\(/`. It catches
  `contentDocument!.write(`, `(x as Document).write(`, `(document).write(` and
  `(x satisfies Document).write(`. Like round 1's `myDocument.write`, it also
  flags any identifier or type ending in `Document` (`(x as MyDocument).write(`).
  That's accepted.
- Known limitation, theoretical, found in the round-3 re-review:
  - an angle-bracket cast `(<Document>x).write(`, which can't be used in
    `.tsx` and which the repo never writes;
  - `doc!!.write(`;
  - `(iframe.contentDocument)!.write(`, whose parens Prettier strips;
  - `getDocument().write(`, the call-return form of the listed aliasing
    limit.
- Known limitation, a false positive: `jsxSrcdoc` also flags `srcDoc`/`srcdoc`
  as a default value (`function f(srcDoc = "")`, `({ srcDoc = '' })`), as it
  already flagged `const srcDoc =`. The author can rename it; it's listed in the
  header.
- Known limitation, theoretical: `setAttributeNS(null, 'srcdoc', s)`, listed in
  the header.
- Known limitation, theoretical: a comment between the property and `=`;
  destructuring writes (`[el.innerHTML] = [s]`); `document['write'](s)`;
  JSX spread `{...{ srcDoc: s }}`. They're listed in the guard's header with the
  other known limits.

## Verification

- Stage 2: the R2–R4 and R6–R7 cases and the `==` P2 case fail on the current
  script. The others pass.
- Stage 3: `check:test-lock -- --verify` and `npm run verify`.
- Orchestrator mutation gate: criterion 4.
- Stage 4: a review that tries further real-world forms.
- Stage 6 retro: Stage 1's guard bullet gains "each sink's variant forms",
  with an independent read and the skill-routing eval.
