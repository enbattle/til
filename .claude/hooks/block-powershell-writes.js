// PreToolUse hook (PowerShell): denies a PowerShell command that writes a file
// inside the project, because Windows PowerShell 5.1 re-encodes what it
// writes. Set-Content and Out-File default to the ANSI code page or UTF-16,
// and `-Encoding utf8` adds a byte-order mark; text-encoding.test.ts catches
// the damage at verify, but only after the work is done. The writes it looks
// for: Set-Content, Add-Content, Out-File and Tee-Object and their aliases sc,
// ac and tee, with the path positional or named (-Path, -LiteralPath,
// -FilePath, also as -Path:value); the redirections >, >>, 2> and *> to a
// path; and [IO.File]::Write*/Append*. A path may use $env:X or ${env:X},
// $PWD, ~ or $HOME, or a variable assigned a quoted string literal earlier in
// the same command ($f='...'; ... | Set-Content $f), where a double-quoted one
// that expands a computed part ($f="docs\$name.md") resolves to the text
// before that part; a reassigned variable
// resolves to the assignment in force where each write runs, a variable last
// assigned anything but a quoted literal ($f = Join-Path ...) is unknown, and
// a write before any assignment fails open. Assignment-looking text inside a
// quoted string (Write-Host "x; $f='...'") isn't an assignment. Writes outside the project (the
// scratchpad, $env:TEMP), $null and Out-Null are allowed.
//
// It matches on the command text, not a full PowerShell parse, so it can miss
// a write (docs/specs/harness-follow-ups.md lists the vectors it covers). It
// fails open: unparseable input, a path it can't resolve or any error allows
// the command. Known limitations, where text-encoding.test.ts stays the gate:
// - a `cd` inside the command isn't tracked, so a relative path resolves
//   against the session's cwd, which can deny or allow wrongly;
// - a target only known at run time ($_.FullName, a computed or unassigned
//   variable) fails open;
// - typed ([string]$f=...) and scoped ($script:f) assignments, a
//   parenthesised ($f) target and $(...) subexpressions aren't recognized,
//   so they fail open;
// - a variable chain ($f="$root\docs\a.md") fails open;
// - text order isn't run order: a script block or function defined before the
//   assignment it reads resolves against the assignments above its text;
// - Set-Variable isn't recognized as an assignment;
// - dot-sourcing a write cmdlet (. Set-Content ...) isn't recognized;
// - New-Item -Value, Export-Csv and Start-Transcript aren't checked; nothing
//   in this repo uses them to write files.
//
// A second rule (docs/specs/drift-and-rewrite-guards.md) denies an inline
// interpreter script that writes a file and is handed text through a
// command-line argument, wherever the file is: native-argument quoting can
// truncate or alter that text (on 2026-10-07 it cut a draft to 1.7 KB). The
// script is `node -e`/`--eval`/`-p`/`--print` text (also `-pe` and
// `--eval=<script>`) naming writeFileSync, writeFile, appendFileSync,
// appendFile or createWriteStream, or `python`/`py`/`python3 -c` text (also
// combined, `-Ic`) with open(..., 'w' or 'a'), .write_text( or .write_bytes(.
// The text is a `$var` argument after the script (bare or in a double-quoted
// word) last assigned anything but a quoted literal, a `$(...)` argument or a
// parenthesized `( ... )` argument; or a computed `$var` or `$(...)` that a
// double-quoted script expands into itself. A double-quoted assignment that
// expands a computed `$var` or a `$(...)` isn't a literal, and neither is a
// here-string assignment, so a here-string content variable is denied too.
// Literal text isn't safe either when it holds a double quote or a newline:
// PowerShell 5.1 strips an embedded double quote from a native argument. So
// a here-string argument, a quoted argument, or a `$var` whose assignment in
// force is a literal, holding either, is denied as well. A path-like literal
// argument or a path in a literal-assigned variable, `--`, a script file
// (node x.mjs $n) and a script that doesn't write are allowed. Its known
// gaps, each theoretical (none of 71 past inline write commands in this
// project's transcripts used them; the spec's Review decisions):
// - a script read from a file, an alias or a full path for node or python,
//   and a flag with a separate value before -e or -c;
// - a variable never assigned in the command (a loop variable), a scoped one
//   ($script:n) and a typed one ([string]$n = ...);
// - an indirect launch (cmd /c node ..., & 'node' ..., Start-Process node
//   -ArgumentList ..., iex "node -e ...");
// - a backtick line continuation followed by CRLF;
// - a compound assignment ($n = ''; $n += Get-Content ...) after a literal;
// - script text held in a variable (node -e $js);
// - captured output ($out = node -e ..., $null = node -e ...), since the
//   interpreter isn't at a statement start;
// - splatting (node -e ... @a);
// - write forms outside the list: python open(..., 'x') or 'r+', an open(...)
//   nested two levels deep, node writeSync/openSync.
// Never throws past its own try/catch and always exits 0.
import path from 'node:path';
import os from 'node:os';

const REASON =
  'Blocked: this PowerShell command writes a file inside the project. Windows ' +
  'PowerShell 5.1 re-encodes what it writes (Set-Content/Out-File default to the ' +
  'ANSI code page or UTF-16, and -Encoding utf8 adds a byte-order mark), which ' +
  'corrupts repo text. Use the Edit or Write tool instead, or a script file ' +
  'that reads its input from a file and writes UTF-8. Writes outside the ' +
  'project, such as the scratchpad, are allowed.';
const ARGUMENT_REASON =
  'Blocked: this PowerShell command runs an inline script that writes a file and ' +
  'passes text through a command-line argument; quoting can truncate or alter it. ' +
  'Use the Edit or Write tool instead, or a script that reads its input from a file.';

// The inline-script flags, and what makes an inline script a file write.
// Combined short flags count too (`node -pe`, `python -Ic`); a node script can
// also be joined to its flag (`--eval=<script>`), see INLINE_JOINED.
const INLINE_FLAGS = { node: /^(?:-[ep]{1,2}|--eval|--print)$/, python: /^-[A-Za-z]*c$/ };
const INLINE_JOINED = /^--(?:eval|print)=/;
const NODE_WRITES =
  /\b(?:writeFileSync|writeFile|appendFileSync|appendFile|createWriteStream)\b/;
const PYTHON_WRITES =
  /\bopen\s*\((?:[^()]|\([^()]*\))*?['"][wa][bt+]*['"]|\.write_(?:text|bytes)\s*\(/;

const WRITE_CMDLETS = new Set([
  'set-content',
  'add-content',
  'out-file',
  'tee-object',
  // Their built-in aliases.
  'sc',
  'ac',
  'tee',
]);
// Parameters (lowercase) whose value is the file written.
const PATH_PARAMS = ['path', 'literalpath', 'filepath', 'pspath', 'lp'];
// Parameters that take a value which is not the path.
const VALUE_PARAMS = [
  'value',
  'encoding',
  'width',
  'inputobject',
  'filter',
  'include',
  'exclude',
  'credential',
  'stream',
  'variable',
  // Common parameters.
  'erroraction',
  'errorvariable',
  'warningaction',
  'warningvariable',
  'informationaction',
  'informationvariable',
  'outvariable',
  'outbuffer',
  'pipelinevariable',
];
// `$f =` at the start of a statement; the right-hand side follows the match.
const ASSIGNMENT = /(?:^|[;\r\n|&({])\s*(\$(\w+)\s*=(?!=)\s*)/g;
// A right-hand side that is one quoted string literal and nothing more.
const LITERAL = /^('(?:[^']|'')*'|"(?:[^"`]|`.|"")*")\s*(?=$|[;\r\n|&)}#])/;
const IO_FILE_WRITE =
  /\[\s*(?:System\.)?IO\.File\s*\]\s*::\s*(?:Write|Append)\w*\s*\(\s*("(?:[^"`]|`.|"")*"|'(?:[^']|'')*'|[^,\s)]+)/gi;

const isWindowsAbsolute = (p) => /^[A-Za-z]:[\\/]/.test(p) || /^\\\\/.test(p);

/** Splits a command into words, separators and redirections, honouring
 * quotes, backtick escapes, here-strings and comments. Each quoted string's
 * [start, end) range in the command is pushed onto `quotes`. A word's `exp`
 * is the part of it PowerShell expands variables in (unquoted and
 * double-quoted text, an escaped `$` blanked out); a separator's `v` is its
 * character. */
function tokenize(s, quotes = []) {
  const tokens = [];
  let cur = null;
  let quoted = false;
  let exp = '';
  let start = 0; // where the current word began
  let at = 0; // where the character being read began
  const flush = () => {
    if (cur !== null) tokens.push({ t: 'word', v: cur, quoted, at: start, exp });
    cur = null;
    quoted = false;
    exp = '';
  };
  const append = (text, q = false, expands = text) => {
    if (cur === null) start = at;
    cur = (cur ?? '') + text;
    quoted = quoted || q;
    exp += expands;
  };
  let i = 0;
  while (i < s.length) {
    at = i;
    const c = s[i];
    if (c === ' ' || c === '\t') {
      flush();
      i++;
    } else if (c === '$' && s[i + 1] === '{') {
      // A braced variable (`${env:X}`) is part of the word, not a block.
      const end = s.indexOf('}', i + 2);
      const stop = end === -1 ? s.length : end + 1;
      append(s.slice(i, stop));
      i = stop;
    } else if ('\r\n;|&(){}'.includes(c)) {
      flush();
      tokens.push({ t: 'sep', v: c });
      i++;
    } else if (c === '#' && cur === null) {
      while (i < s.length && s[i] !== '\n') i++;
    } else if (
      c === '@' &&
      (s[i + 1] === '"' || s[i + 1] === "'") &&
      /^\r?\n/.test(s.slice(i + 2))
    ) {
      const close = `\n${s[i + 1]}@`;
      const end = s.indexOf(close, i + 2);
      const stop = end === -1 ? s.length : end + close.length;
      const text = s.slice(i + 2, end === -1 ? s.length : end);
      append(text, true, s[i + 1] === '"' ? text : '');
      quotes.push([at, stop]);
      i = stop;
    } else if (c === '"' || c === "'") {
      let text = '';
      let expands = '';
      i++;
      while (i < s.length) {
        if (c === '"' && s[i] === '`' && i + 1 < s.length) {
          text += decodeEscape(s[i + 1]);
          expands += s[i + 1] === '$' ? '_' : s[i + 1];
          i += 2;
        } else if (s[i] === c && s[i + 1] === c) {
          text += c;
          expands += c;
          i += 2;
        } else if (s[i] === c) {
          i++;
          break;
        } else {
          text += s[i];
          expands += s[i++];
        }
      }
      append(text, true, c === '"' ? expands : '');
      quotes.push([at, i]);
    } else if (c === '`') {
      const next = s[i + 1] ?? '';
      append(next, false, next === '$' ? '_' : next);
      i += 2;
    } else if (c === '>') {
      let op = '>';
      if (cur !== null && !quoted && /^[1-6*]$/.test(cur)) {
        op = cur + op;
        cur = null;
      } else {
        flush();
      }
      i++;
      if (s[i] === '>') {
        op += '>';
        i++;
      }
      if (s[i] === '&' && /[1-6]/.test(s[i + 1] ?? '')) {
        i += 2; // 2>&1: merges streams, writes no file
      } else {
        tokens.push({ t: 'redir', v: op, at });
      }
    } else {
      append(c);
      i++;
    }
  }
  flush();
  return tokens;
}

/** The file paths a cmdlet call writes, from the words after its name. */
function cmdletTargets(args) {
  const named = [];
  const positional = [];
  for (let k = 0; k < args.length; k++) {
    const { v, quoted } = args[k];
    const param = !quoted && /^-([A-Za-z]+)(?::(.*))?$/.exec(v);
    if (param) {
      const name = param[1].toLowerCase();
      const inline = param[2];
      const isPath = PATH_PARAMS.includes(name);
      const takesValue =
        isPath || VALUE_PARAMS.some((p) => p.startsWith(name) && name.length > 1);
      if (inline !== undefined && inline !== '') {
        if (isPath) named.push(inline);
      } else if (takesValue && k + 1 < args.length) {
        if (isPath) named.push(args[k + 1].v);
        k++;
      }
    } else {
      positional.push(v);
    }
  }
  // A named path parameter binds the path, and positional words then bind to
  // the value. Otherwise position 0 is the path for all four cmdlets.
  if (named.length > 0) return named;
  return positional.slice(0, 1);
}

/** Every file path the command writes, as written in the command, with the
 * position in the command where that write runs. */
function writeTargets(command) {
  const targets = [];
  const tokens = tokenize(command);
  let atCommandStart = true;
  for (let k = 0; k < tokens.length; k++) {
    const token = tokens[k];
    if (token.t === 'sep') {
      atCommandStart = true;
      continue;
    }
    if (token.t === 'redir') {
      const next = tokens[k + 1];
      if (next && next.t === 'word') targets.push({ target: next.v, at: token.at });
      k++;
      atCommandStart = false;
      continue;
    }
    const name = token.v.replace(
      /^Microsoft\.PowerShell\.Utility\\|^Microsoft\.PowerShell\.Management\\/i,
      '',
    );
    if (atCommandStart && !token.quoted && WRITE_CMDLETS.has(name.toLowerCase())) {
      const args = [];
      while (k + 1 < tokens.length && tokens[k + 1].t === 'word') args.push(tokens[++k]);
      targets.push(...cmdletTargets(args).map((target) => ({ target, at: token.at })));
    }
    atCommandStart = false;
  }
  for (const match of command.matchAll(IO_FILE_WRITE)) {
    let arg = match[1];
    if (/^"/.test(arg)) arg = arg.slice(1, -1).replace(/`(.)/g, '$1').replace(/""/g, '"');
    else if (/^'/.test(arg)) arg = arg.slice(1, -1).replace(/''/g, "'");
    targets.push({ target: arg, at: match.index });
  }
  return targets;
}

/** Every assignment at a statement start outside quoted text, in order: the
 * lowercase variable name, its value (the quoted string literal's text, as
 * written for a double-quoted one, or null when the right-hand side isn't a
 * quoted string literal), whether it's computed and its position. A
 * double-quoted string that expands a computed `$var` or a `$(...)` keeps its
 * text as the value, since its literal part still says where a path lands
 * (rule 1), but is computed, so it carries content (rule 2). */
function assignments(command) {
  const quotes = [];
  tokenize(command, quotes);
  const found = [];
  for (const match of command.matchAll(ASSIGNMENT)) {
    const [whole, lhs, name] = match;
    const at = match.index + whole.length - lhs.length;
    if (quotes.some(([from, to]) => at >= from && at < to)) continue;
    const literal = LITERAL.exec(command.slice(match.index + whole.length));
    let value = null;
    let computed = true;
    if (literal) {
      const text = literal[1];
      if (!text.startsWith('"')) {
        value = text.slice(1, -1).replace(/''/g, "'");
        computed = false;
      } else {
        value = decodeEscapes(text.slice(1, -1)).replace(/""/g, '"');
        computed = expandsContent(
          text.slice(1, -1).replace(/`./g, ' '),
          varsAt(found, at),
        );
      }
    }
    found.push({ name: name.toLowerCase(), value, computed, at });
  }
  return found;
}

/** Decodes backtick escapes in double-quoted text: `n, `r and `t are a
 * newline, a carriage return and a tab; any other character stands for
 * itself. */
function decodeEscapes(text) {
  return text.replace(/`(.)/gs, (_, c) => decodeEscape(c));
}

/** What a double-quoted backtick escape of `c` stands for. */
function decodeEscape(c) {
  return { n: '\n', r: '\r', t: '\t' }[c] ?? c;
}

/** The variables in force at position `at`: each one's last assignment
 * before it ({ value, computed }). A variable assigned only later is unknown
 * there. */
function varsAt(found, at) {
  const vars = new Map();
  for (const a of found) if (a.at < at) vars.set(a.name, a);
  return vars;
}

/** Expands the variables a path can be resolved from; null if it can't be. */
function expand(target, cwd, vars) {
  let p = target.replace(/\$(?:\{(\w+)\}|(\w+)\b(?!:))/g, (whole, braced, bare) => {
    const value = vars.get((braced ?? bare).toLowerCase())?.value;
    return value === undefined || value === null ? whole : value;
  });
  p = p.replace(/\$\{?env:(\w+)\}?/gi, (whole, name) => process.env[name] ?? whole);
  p = p
    .replace(/^\$\{?pwd\}?(?=$|[\\/])/i, cwd)
    .replace(/^(?:~|\$\{?home\}?)(?=$|[\\/])/i, os.homedir());
  // An unknown variable: what comes before it (`docs\$name.md`) still says
  // where the file lands; one at the start (`$dir\a.md`) can't be resolved.
  const variable = p.indexOf('$');
  if (variable === 0 || p === '') return null;
  return variable === -1 ? p : p.slice(0, variable);
}

/** Whether `target` (as written) resolves inside `project`. A Windows
 * absolute path never counts as inside a POSIX project (CI runs on Linux). */
function inside(target, cwd, project, vars) {
  if (/^(\$null|nul)$/i.test(target)) return false;
  const p = expand(target, cwd, vars);
  if (p === null) return false;
  const api = isWindowsAbsolute(project) ? path.win32 : path.posix;
  if (api === path.posix && isWindowsAbsolute(p)) return false;
  const resolved = api.resolve(cwd, api === path.posix ? p.replace(/\\/g, '/') : p);
  const rel = api.relative(project, resolved);
  return rel === '' || (!rel.startsWith('..') && !api.isAbsolute(rel));
}

/** The interpreter a command name runs, for the inline-script rule. */
function interpreterOf(name) {
  const n = name.toLowerCase().replace(/\.exe$/, '');
  if (n === 'node') return 'node';
  if (n === 'python' || n === 'py' || n === 'python3') return 'python';
  return null;
}

/** Whether an inline script (`node -e` or `python -c` text) writes a file. */
function scriptWrites(interpreter, script) {
  if (interpreter === 'node') return NODE_WRITES.test(script);
  return PYTHON_WRITES.test(script);
}

/** The variables a word's expanded text (`exp`) names, as lowercase names. */
function namedVars(exp) {
  return [...exp.matchAll(/\$(?:\{(\w+)\}|(\w+)\b(?!:))/g)].map(([, braced, bare]) =>
    (braced ?? bare).toLowerCase(),
  );
}

/** Whether text PowerShell expands (a word's `exp`) holds something that isn't
 * a quoted literal: a `$(...)` subexpression, or a `$var` last assigned
 * anything but a quoted literal (or a double-quoted string expanding such
 * text). A variable never assigned fails open. */
function expandsContent(exp, vars) {
  if (exp.includes('$(')) return true;
  return namedVars(exp).some((name) => vars.get(name)?.computed === true);
}

/** Whether literal text would be altered on its way into a native argument:
 * PowerShell 5.1 strips an embedded double quote, and a newline splits it in
 * quoting. */
const mangled = (text) => typeof text === 'string' && /["\r\n]/.test(text);

/** Whether the words from `tokens[k]` on, up to the end of the statement,
 * pass text that isn't a quoted literal, or literal text holding a double
 * quote or a newline: a `$var` (bare or inside a double-quoted word) last
 * assigned anything but a quoted literal, or a literal holding either; a
 * `$(...)` subexpression; a parenthesized expression `( ... )`; or a quoted
 * or here-string word holding either. */
function passesContent(tokens, k, vars) {
  for (; k < tokens.length; k++) {
    const token = tokens[k];
    if (token.t === 'redir') {
      k++;
      continue;
    }
    if (token.t !== 'word') return token.v === '(';
    const next = tokens[k + 1];
    if (token.exp.endsWith('$') && next?.t === 'sep' && next.v === '(') return true;
    if (expandsContent(token.exp, vars)) return true;
    if (mangled(token.v)) return true;
    if (namedVars(token.exp).some((name) => mangled(vars.get(name)?.value))) return true;
  }
  return false;
}

/** Whether the command runs an inline interpreter script that writes a file
 * and hands it text through a command-line argument (the 2026-10-07 shape). */
function writesThroughArgument(command, found) {
  const tokens = tokenize(command);
  let atCommandStart = true;
  for (let k = 0; k < tokens.length; k++) {
    const token = tokens[k];
    if (token.t !== 'word') {
      atCommandStart = token.t === 'sep';
      continue;
    }
    const interpreter = atCommandStart && !token.quoted && interpreterOf(token.v);
    atCommandStart = false;
    if (!interpreter) continue;
    // Flags up to the inline-script flag; a word that isn't a flag is a
    // script file, so the command isn't inline. `--eval=<script>` is one word
    // holding both (quoted, because of the script).
    let script = null;
    let rest = 0; // where the arguments after the script start
    for (let m = k + 1; m < tokens.length && tokens[m].t === 'word'; m++) {
      const word = tokens[m];
      if (interpreter === 'node' && INLINE_JOINED.test(word.v)) {
        const prefix = word.v.match(INLINE_JOINED)[0];
        script = {
          ...word,
          v: word.v.slice(prefix.length),
          exp: word.exp.slice(prefix.length),
        };
        rest = m + 1;
        break;
      }
      if (word.quoted || !word.v.startsWith('-')) break;
      if (INLINE_FLAGS[interpreter].test(word.v)) {
        script = tokens[m + 1]?.t === 'word' ? tokens[m + 1] : null;
        rest = m + 2;
        break;
      }
    }
    if (!script || !scriptWrites(interpreter, script.v)) continue;
    const vars = varsAt(found, token.at);
    // A double-quoted script expands computed text into itself.
    if (expandsContent(script.exp, vars)) return true;
    if (passesContent(tokens, rest, vars)) return true;
  }
  return false;
}

let data = '';
process.stdin.on('data', (chunk) => {
  data += chunk;
});
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(data);
    const command = input.tool_input && input.tool_input.command;
    const project = process.env.CLAUDE_PROJECT_DIR || input.cwd;
    const cwd = input.cwd || project;
    if (input.tool_name === 'PowerShell' && typeof command === 'string' && project) {
      const found = assignments(command);
      const writes = writeTargets(command);
      const reason = writes.some(({ target, at }) =>
        inside(target, cwd, project, varsAt(found, at)),
      )
        ? REASON
        : writesThroughArgument(command, found)
          ? ARGUMENT_REASON
          : null;
      if (reason) {
        process.stdout.write(
          JSON.stringify({
            hookSpecificOutput: {
              hookEventName: 'PreToolUse',
              permissionDecision: 'deny',
              permissionDecisionReason: reason,
            },
          }),
        );
      }
    }
  } catch {
    // Malformed input or a parse failure: allow, never block.
  }
  process.exit(0);
});
