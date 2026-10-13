// PreToolUse hook (PowerShell): denies a PowerShell command that writes a
// file, because Windows PowerShell 5.1 re-encodes what it writes (Set-Content
// and Out-File default to the ANSI code page or UTF-16, and `-Encoding utf8`
// adds a byte-order mark), and denies an inline node/python script that
// writes a file, because 5.1's native-argument quoting can truncate or alter
// the text it passes (on 2026-10-07 it cut a draft to 1.7 KB).
//
// Deliberately blunt (docs/specs/in-process-checks.md): it matches command
// text with no path or variable resolution, so a scratchpad write is denied
// too. It catches slips, not evasion; text-encoding.test.ts stays the gate.
// With comments and quoted string contents removed, a command is denied when it:
// - names Set-Content, Add-Content, Out-File or Tee-Object (any case), or
//   the aliases sc, ac or tee, as a command word (at the start of a line or
//   after ; | & ( {), so `git grep Set-Content` is allowed;
// - calls [IO.File]::Write* or Append* (also [System.IO.File]);
// - redirects output (>, >>, 2>, *>, 3>> ...) to anything but $null; a
//   stream merge such as 2>&1 is fine.
// On the full text, it denies `node -e/--eval/-p/--print` or
// `python/python3/py -c` (also combined, like -Ic) whose text names a file
// write: writeFile(Sync), appendFile(Sync), createWriteStream, open(...)
// with 'w' or 'a' after a comma, write_text or write_bytes.
//
// Known gaps (spec, "Review decisions"), allowed today: `node
// --input-type=module -e …` (a flag before -e), an assignment such as
// `$r = node -e …`, `python -X utf8 -c …`, `python -W ignore -c …`,
// `python3.12 -c …` and `py -3.12 -c …`, `open(str(p), 'w')` (a nested call
// before the mode), a write through `fs.openSync` + `writeSync`,
// `Start-Process -RedirectStandardOutput`, `Export-Csv`, `New-Item -Value`
// and `Invoke-Expression "…"`. A nested `"` inside `$( )` in a string is
// denied when it needn't be. text-encoding.test.ts stays the gate for the
// encoding damage these could do.
//
// Any other tool, malformed input or an error allows the command: exit 0,
// no output. It never throws past its own try/catch.
import { isMain } from '../../scripts/lib.mjs';

const ENCODING_REASON =
  'Blocked: this PowerShell command writes a file. Windows PowerShell 5.1 ' +
  're-encodes what it writes (Set-Content/Out-File default to the ANSI code ' +
  'page or UTF-16, and -Encoding utf8 adds a byte-order mark), which corrupts ' +
  'text. Use the Write or Edit tool instead, or the Bash tool.';
const ARGUMENT_REASON =
  'Blocked: this PowerShell command runs an inline node/python script that ' +
  'writes a file. Windows PowerShell 5.1 can truncate or alter text passed ' +
  'as a native argument. Use the Write or Edit tool instead, or the Bash tool.';

// Where a command word can start: the start of a line, or after ; | & ( {
// (which covers a script block and an if/foreach body).
const WORD_START = String.raw`(?:^|[;|&({]\s*)`;
const WRITE_CMDLETS = new RegExp(
  `${WORD_START}\\s*(?:set-content|add-content|out-file|tee-object|sc|ac|tee)(?![\\w-])`,
  'im',
);
const DOTNET_WRITE = /\[(?:system\.)?io\.file\]::\s*(?:write|append)/i;
const REDIRECT = /(?:\d|\*)?>>?\s*(\S*)/g;
const NODE_INLINE = new RegExp(
  `${WORD_START}\\s*node(?:\\.exe)?\\s+(?:-[ep]{1,2}|--eval|--print)(?=[\\s=]|$)`,
  'im',
);
const PYTHON_INLINE = new RegExp(
  `${WORD_START}\\s*(?:python3?|py)(?:\\.exe)?\\s+(?:-\\w+\\s+)*-[A-Za-z]*c(?=\\s|$)`,
  'im',
);
const SCRIPT_WRITES =
  /writeFile|appendFile|createWriteStream|write_text|write_bytes|open\s*\([^)]*,\s*['"][wa][bt+]*['"]/;

// Comments, here-strings, then single- and double-quoted strings, in one
// alternation, so a quote inside a string of the other kind or inside a
// comment (`# don't`) can't pair with a quote in a later command. A # starts
// a comment only at the start of a token, so `a#b` isn't one.
const QUOTED =
  /<#[\s\S]*?#>|(?<![^\s;|&({])#[^\n]*|@'[\s\S]*?'@|@"[\s\S]*?"@|'(?:[^']|'')*'|"(?:[^"`]|`[\s\S])*"/g;

/** `command` with its comments and the contents of its quoted strings
 * removed, in one left-to-right pass. */
function unquoted(command) {
  return command.replace(QUOTED, (match) =>
    match.startsWith('#') || match.startsWith('<#')
      ? ''
      : /^@?"/.test(match)
        ? '""'
        : "''",
  );
}

/** Whether `text` redirects output to anything but $null (a stream merge
 * like 2>&1 isn't a write). */
function redirectsToFile(text) {
  for (const [, target] of text.matchAll(REDIRECT)) {
    if (!/^(?:&\d|\$null\b)/i.test(target)) return true;
  }
  return false;
}

/** Why `command` is denied, or null to allow it. */
export function denyReason(command) {
  const text = unquoted(command);
  if (WRITE_CMDLETS.test(text) || DOTNET_WRITE.test(text) || redirectsToFile(text)) {
    return ENCODING_REASON;
  }
  if (
    (NODE_INLINE.test(command) || PYTHON_INLINE.test(command)) &&
    SCRIPT_WRITES.test(command)
  ) {
    return ARGUMENT_REASON;
  }
  return null;
}

if (isMain(import.meta.url)) {
  let data = '';
  process.stdin.on('data', (chunk) => {
    data += chunk;
  });
  process.stdin.on('end', () => {
    try {
      const input = JSON.parse(data);
      const command = input.tool_input?.command;
      const reason =
        input.tool_name === 'PowerShell' && typeof command === 'string'
          ? denyReason(command)
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
    } catch {
      // Malformed input or an error: allow, never block.
    }
    process.exit(0);
  });
}
