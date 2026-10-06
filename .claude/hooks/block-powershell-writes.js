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
// the same command ($f='...'; ... | Set-Content $f); a reassigned variable
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
// Never throws past its own try/catch and always exits 0.
import path from 'node:path';
import os from 'node:os';

const REASON =
  'Blocked: this PowerShell command writes a file inside the project. Windows ' +
  'PowerShell 5.1 re-encodes what it writes (Set-Content/Out-File default to the ' +
  'ANSI code page or UTF-16, and -Encoding utf8 adds a byte-order mark), which ' +
  'corrupts repo text. Use the Edit or Write tool instead, or a Node script ' +
  "(node -e with fs.writeFileSync(path, text, 'utf8')). Writes outside the " +
  'project, such as the scratchpad, are allowed.';

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
 * [start, end) range in the command is pushed onto `quotes`. */
function tokenize(s, quotes = []) {
  const tokens = [];
  let cur = null;
  let quoted = false;
  let start = 0; // where the current word began
  let at = 0; // where the character being read began
  const flush = () => {
    if (cur !== null) tokens.push({ t: 'word', v: cur, quoted, at: start });
    cur = null;
    quoted = false;
  };
  const append = (text, q = false) => {
    if (cur === null) start = at;
    cur = (cur ?? '') + text;
    quoted = quoted || q;
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
      tokens.push({ t: 'sep' });
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
      append(s.slice(i + 2, end === -1 ? s.length : end), true);
      quotes.push([at, stop]);
      i = stop;
    } else if (c === '"' || c === "'") {
      let text = '';
      i++;
      while (i < s.length) {
        if (c === '"' && s[i] === '`' && i + 1 < s.length) {
          text += s[i + 1];
          i += 2;
        } else if (s[i] === c && s[i + 1] === c) {
          text += c;
          i += 2;
        } else if (s[i] === c) {
          i++;
          break;
        } else {
          text += s[i++];
        }
      }
      append(text, true);
      quotes.push([at, i]);
    } else if (c === '`') {
      append(s[i + 1] ?? '');
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
 * lowercase variable name, its value (null unless the right-hand side is a
 * quoted string literal) and its position. */
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
    if (literal) {
      const text = literal[1];
      value = text.startsWith('"')
        ? text.slice(1, -1).replace(/`(.)/g, '$1').replace(/""/g, '"')
        : text.slice(1, -1).replace(/''/g, "'");
    }
    found.push({ name: name.toLowerCase(), value, at });
  }
  return found;
}

/** The variables in force at position `at`: each one's last assignment
 * before it (null when that wasn't a quoted literal). A variable assigned
 * only later is unknown there. */
function varsAt(found, at) {
  const vars = new Map();
  for (const a of found) if (a.at < at) vars.set(a.name, a.value);
  return vars;
}

/** Expands the variables a path can be resolved from; null if it can't be. */
function expand(target, cwd, vars) {
  let p = target.replace(/\$(?:\{(\w+)\}|(\w+)\b(?!:))/g, (whole, braced, bare) => {
    const name = (braced ?? bare).toLowerCase();
    const value = vars.get(name);
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
      if (
        writes.some(({ target, at }) => inside(target, cwd, project, varsAt(found, at)))
      ) {
        process.stdout.write(
          JSON.stringify({
            hookSpecificOutput: {
              hookEventName: 'PreToolUse',
              permissionDecision: 'deny',
              permissionDecisionReason: REASON,
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
