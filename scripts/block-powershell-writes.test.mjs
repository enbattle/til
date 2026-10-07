// @vitest-environment node
// Vectors for .claude/hooks/block-powershell-writes.js
// (docs/specs/harness-follow-ups.md, criteria 5 to 7). The hook matches on the
// command text, which isn't a full PowerShell parse, so the spec lists the
// writes it must deny and the commands it must allow instead of claiming
// completeness. Each case runs the hook as Claude Code would: PreToolUse JSON on
// stdin, with `cwd` and CLAUDE_PROJECT_DIR set to a throwaway project directory.
//
// CI runs on Linux while the hook runs on Windows, so a Windows absolute path
// (C:\...) outside the project must count as outside on either platform.
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanTemps, tempDir } from '../src/test/guard-helpers.mjs';

afterEach(cleanTemps);

const HOOK = resolve('.claude/hooks/block-powershell-writes.js');

function hook(stdin, project = tempDir()) {
  const started = Date.now();
  const result = spawnSync(process.execPath, [HOOK], {
    cwd: project,
    input: stdin,
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: project },
  });
  return { ...result, ms: Date.now() - started };
}

const call = (command, project, tool = 'PowerShell') =>
  JSON.stringify({
    session_id: 'test',
    transcript_path: join(project, 'transcript.jsonl'),
    cwd: project,
    hook_event_name: 'PreToolUse',
    tool_name: tool,
    tool_input: { command },
  });

function runCommand(command, tool) {
  const project = tempDir();
  return hook(call(command(project), project, tool), project);
}

describe('block-powershell-writes', () => {
  // Criterion 5. A function receives the project directory, for the vectors
  // that name it by absolute path.
  it.each([
    ['Set-Content to a relative path', () => 'Set-Content docs\\x.md "a"'],
    ['Out-File with -Encoding utf8', () => '"a" | Out-File -Encoding utf8 src\\y.ts'],
    ['Add-Content -Path', () => 'Add-Content -Path .\\README.md -Value b'],
    ['a > redirection', () => 'echo a > docs\\z.md'],
    ['a >> redirection', () => '"a" >> notes.txt'],
    [
      '[IO.File]::WriteAllText to an absolute project path',
      (project) => `[IO.File]::WriteAllText("${join(project, 'a.md')}", "x")`,
    ],
    [
      'Set-Content -LiteralPath to a quoted absolute project path',
      (project) => `Set-Content -LiteralPath "${join(project, 'docs', 'a.md')}" a`,
    ],
  ])('denies %s', (_label, command) => {
    const { status, stdout, stderr } = runCommand(command);
    expect(status, stderr).toBe(0);
    const output = JSON.parse(stdout).hookSpecificOutput;
    expect(output.hookEventName).toBe('PreToolUse');
    expect(output.permissionDecision).toBe('deny');
    // The reason names the tools to use instead, and why.
    expect(output.permissionDecisionReason).toMatch(/\bEdit\b/);
    expect(output.permissionDecisionReason).toMatch(/\bWrite\b/);
  });

  // Criterion 6.
  it.each([
    ['Set-Content to $env:TEMP', () => 'Set-Content $env:TEMP\\a.txt x'],
    [
      'Out-File to a scratchpad outside the project',
      () =>
        '"x" | Out-File C:\\Users\\u\\AppData\\Local\\Temp\\claude\\C--x\\0f9e\\scratchpad\\a.txt',
    ],
    [
      'Set-Content to an absolute path outside the project, on this platform',
      () => `Set-Content "${join(tmpdir(), 'til-elsewhere', 'a.txt')}" x`,
    ],
    ['a redirection to $null', () => 'git status > $null'],
    ['an all-streams redirection to $null', () => 'npm run verify *> $null'],
    ['a command that only reads', () => 'Get-Content README.md'],
    ['Out-Null', () => '"x" | Out-Null'],
  ])('allows %s', (_label, command) => {
    const { status, stdout, stderr } = runCommand(command);
    expect(status).toBe(0);
    expect(stdout).toBe('');
    expect(stderr).toBe('');
  });

  // Review decisions, "Fix with a test (4a round 1)". An absolute path outside
  // the throwaway project, valid on this platform.
  const elsewhere = (name) => join(tmpdir(), 'til-elsewhere', name);

  // A named path parameter binds the target, so the positional word after it
  // is the value, not a second path.
  it.each([
    [
      'Add-Content -Path outside, then a positional value',
      () => `Add-Content -Path "${elsewhere('notes.txt')}" "line two"`,
    ],
    [
      'Add-Content -Path to a Windows path outside, then a positional value',
      () => 'Add-Content -Path C:\\Users\\u\\AppData\\Local\\Temp\\notes.txt "line two"',
    ],
    [
      'Set-Content -Path $env:TEMP, then a positional value',
      () => 'Set-Content -Path $env:TEMP\\a.txt x',
    ],
    [
      'Set-Content -LiteralPath outside, then a positional value',
      () => `Set-Content -LiteralPath "${elsewhere('a.md')}" a`,
    ],
    [
      'a path in a variable assigned to an outside literal',
      () =>
        `$f='${elsewhere('x.md')}'; (Get-Content $f -Raw) -replace 'a','b' | Set-Content $f`,
    ],
    [
      'a path in a variable never assigned in the command (fails open)',
      () => `(Get-Content $g -Raw) -replace 'a','b' | Set-Content $g`,
    ],
  ])('allows %s', (_label, command) => {
    const { status, stdout, stderr } = runCommand(command);
    expect(status).toBe(0);
    expect(stdout).toBe('');
    expect(stderr).toBe('');
  });

  it.each([
    // The parameter binds the path even when the value looks like one.
    [
      'Set-Content -Path inside, with an outside-looking positional value',
      () => 'Set-Content -Path docs\\a.md C:\\elsewhere',
    ],
    ['the alias sc', () => 'sc docs\\x.md a'],
    ['the alias ac', () => 'ac docs\\x.md a'],
    ['the alias tee', () => '"a" | tee docs\\x.md'],
    [
      'a braced ${env:CLAUDE_PROJECT_DIR} path',
      () => 'Set-Content ${env:CLAUDE_PROJECT_DIR}\\docs\\x.md a',
    ],
    // The pattern behind the 2026-10-03 ride-sharing encoding defect.
    [
      'a path in a variable assigned to a single-quoted project literal',
      (project) =>
        `$f='${join(project, 'docs', 'x.md')}'; (Get-Content $f -Raw) -replace 'a','b' | Set-Content $f`,
    ],
    [
      'a path in a variable assigned to a double-quoted project literal',
      (project) =>
        `$f = "${join(project, 'docs', 'x.md')}"; (Get-Content $f -Raw) -replace 'a','b' | Set-Content $f`,
    ],
  ])('denies %s', (_label, command) => {
    const { status, stdout, stderr } = runCommand(command);
    expect(status, stderr).toBe(0);
    expect(stdout, 'expected a deny decision').not.toBe('');
    const output = JSON.parse(stdout).hookSpecificOutput;
    expect(output.permissionDecision).toBe('deny');
    expect(output.permissionDecisionReason).toMatch(/\bEdit\b/);
  });

  // Review decisions, "Round 2: fix with a test". A reassigned variable resolves
  // to the assignment in force where each write runs, not the last one.
  it.each([
    [
      'a write through a variable before it is reassigned outside',
      () =>
        `$f='docs\\a.md'; Set-Content $f x; $f="$env:TEMP\\log.txt"; Get-Content docs\\a.md > $f`,
    ],
    [
      'a single project assignment, then a write',
      () => `$f='docs\\a.md'; Set-Content $f x`,
    ],
  ])('denies %s', (_label, command) => {
    const { status, stdout, stderr } = runCommand(command);
    expect(status, stderr).toBe(0);
    expect(stdout, 'expected a deny decision').not.toBe('');
    const output = JSON.parse(stdout).hookSpecificOutput;
    expect(output.permissionDecision).toBe('deny');
    expect(output.permissionDecisionReason).toMatch(/\bEdit\b/);
  });

  it.each([
    [
      'a write through a variable before it is reassigned into the project',
      () => `$f="$env:TEMP\\a.txt"; Set-Content $f x; $f='docs\\a.md'`,
    ],
    [
      'a write through a variable assigned only after it (fails open)',
      () => `Set-Content $f x; $f='docs\\a.md'`,
    ],
  ])('allows %s', (_label, command) => {
    const { status, stdout, stderr } = runCommand(command);
    expect(status).toBe(0);
    expect(stdout).toBe('');
    expect(stderr).toBe('');
  });

  // Review decisions, "Round 3: fix with tests". A computed reassignment makes
  // the variable unknown, and assignment-looking text inside a quoted string
  // isn't an assignment.
  it.each([
    [
      'a variable reassigned from a quoted literal to a computed value (fails open)',
      () => `$f="$env:TEMP\\a.txt"; $f = Join-Path $PWD 'docs\\a.md'; Set-Content $f x`,
    ],
    [
      'a project variable reassigned to a computed value (fails open)',
      () => `$f='docs\\a.md'; $f = Join-Path $env:TEMP 'a.txt'; Set-Content $f x`,
    ],
    [
      'a write through a variable assigned only inside quoted text (fails open)',
      () => `Write-Host "x; $f='docs\\a.md'"; Set-Content $f x`,
    ],
  ])('allows %s', (_label, command) => {
    const { status, stdout, stderr } = runCommand(command);
    expect(status).toBe(0);
    expect(stdout).toBe('');
    expect(stderr).toBe('');
  });

  it.each([
    [
      'a project variable, with an outside assignment only inside double-quoted text',
      () => `$f='docs\\a.md'; Write-Host "note; $f='C:\\Temp\\a'"; sc $f x`,
    ],
    [
      'a project variable, with an outside assignment only inside single-quoted text',
      () => `$f='docs\\a.md'; Write-Host 'a; $f="C:\\Temp\\a"'; Set-Content $f x`,
    ],
  ])('denies %s', (_label, command) => {
    const { status, stdout, stderr } = runCommand(command);
    expect(status, stderr).toBe(0);
    expect(stdout, 'expected a deny decision').not.toBe('');
    const output = JSON.parse(stdout).hookSpecificOutput;
    expect(output.permissionDecision).toBe('deny');
    expect(output.permissionDecisionReason).toMatch(/\bEdit\b/);
  });

  // docs/specs/drift-and-rewrite-guards.md, re-review finding 1: a path in a
  // variable assigned a double-quoted string that expands a computed $var or a
  // $(...) subexpression still resolves to its literal part, so a write to it
  // inside the project is denied.
  it.each([
    [
      'a path expanding a computed $var',
      () => `$c = Get-Date -Format yyyy; $f = "docs\\$c.md"; Set-Content $f 'x'`,
    ],
    [
      'a path expanding a $(...) subexpression',
      () => `$f = "docs\\$(Get-Date -Format yyyy).md"; Set-Content $f 'x'`,
    ],
    [
      'a path expanding $(...), written with a > redirection',
      () => `$f = "src\\content\\$(1+1).md"; 'x' > $f`,
    ],
    [
      'a path expanding a computed $var, written with Out-File',
      () =>
        `$n = (Get-ChildItem docs).Count; $f = "docs\\report-$n.md"; 'x' | Out-File $f`,
    ],
    [
      'a topic path built from a computed slug',
      () =>
        `$name = $title.ToLower() -replace ' ','-'; $f = "src\\content\\ai-and-ml\\$name.md"; Set-Content $f $body`,
    ],
  ])('denies %s', (_label, command) => {
    const { status, stdout, stderr } = runCommand(command);
    expect(status, stderr).toBe(0);
    expect(stdout, 'expected a deny decision').not.toBe('');
    const output = JSON.parse(stdout).hookSpecificOutput;
    expect(output.permissionDecision).toBe('deny');
    expect(output.permissionDecisionReason).toMatch(/\bEdit\b/);
    expect(output.permissionDecisionReason).toMatch(/\bWrite\b/);
  });

  it.each([
    [
      'a path outside the project expanding a computed $var',
      () =>
        `$c = Get-Date -Format yyyy; $f = "${elsewhere('report')}-$c.md"; Set-Content $f 'x'`,
    ],
    [
      'a path under $env:TEMP expanding a $(...) subexpression',
      () => `$f = "$env:TEMP\\$(Get-Date -Format yyyy).md"; Set-Content $f 'x'`,
    ],
  ])('allows %s', (_label, command) => {
    const { status, stdout, stderr } = runCommand(command);
    expect(status).toBe(0);
    expect(stdout).toBe('');
    expect(stderr).toBe('');
  });

  // docs/specs/drift-and-rewrite-guards.md, criteria 8 and 9: an inline
  // interpreter script that writes a file, handed text through a command-line
  // argument. Native-argument quoting can truncate or alter that text, wherever
  // the file is, so the target path isn't checked.
  describe('an inline write script given a content argument', () => {
    const NODE_WRITE = `"require('fs').writeFileSync(process.argv[1], process.argv[2])"`;
    // The 2026-10-07 incident, exactly as it was run.
    const INCIDENT =
      `$f='src/content/x/y.md'; $c=[IO.File]::ReadAllText($f); $n=$c.Replace('a','b'); ` +
      `if ($n -ne $c) { node -e "require('fs').writeFileSync(process.argv[1], process.argv[2])" $f $n }`;

    it.each([
      ['the 2026-10-07 incident command', () => INCIDENT],
      [
        'node --eval with a computed $var',
        () =>
          `$n = (Get-Content -Raw docs\\a.md) -replace 'x','y'; node --eval "require('fs').writeFileSync('docs/a.md', process.argv[1])" $n`,
      ],
      [
        'node -p with appendFileSync and a computed $var inside a double-quoted word',
        () =>
          `$n = Get-Content -Raw a.md; node -p "require('fs').appendFileSync('a.md', process.argv[1])" "$n"`,
      ],
      [
        'node -e with createWriteStream and a computed $var',
        () =>
          `$n = Get-Content -Raw a.md; node -e "require('fs').createWriteStream('a.md').end(process.argv[1])" $n`,
      ],
      [
        'node -e with writeFile and a computed $var, outside the project',
        () =>
          `$n = Get-Content -Raw a.md; node -e "require('fs').writeFile(process.argv[1], process.argv[2], () => {})" C:\\Users\\u\\AppData\\Local\\Temp\\a.md $n`,
      ],
      [
        "python -c with open(..., 'w') and a computed $var",
        () =>
          `$t = Get-Content -Raw a.md; python -c "import sys; open(sys.argv[1], 'w').write(sys.argv[2])" a.md $t`,
      ],
      [
        "python3 -c with open(..., 'a') and a computed $var",
        () =>
          `$t = (Get-Content -Raw a.md).Trim(); python3 -c "import sys; open('a.md', 'a').write(sys.argv[1])" $t`,
      ],
      [
        'py -c with .write_text( and a computed $var',
        () =>
          `$t = Get-Content -Raw a.md; py -c "import pathlib, sys; pathlib.Path('a.md').write_text(sys.argv[1])" $t`,
      ],
      [
        'python -c with .write_bytes( and a computed $var',
        () =>
          `$t = Get-Content -Raw a.md; python -c "import pathlib, sys; pathlib.Path('a.md').write_bytes(sys.argv[1].encode())" $t`,
      ],
      [
        'a $(Get-Content -Raw x) argument',
        () => `node -e ${NODE_WRITE} a.md $(Get-Content -Raw x)`,
      ],
      [
        'a $(...) argument to python -c',
        () =>
          `python -c "import sys; open('a.md', 'w').write(sys.argv[1])" $(Get-Content -Raw x)`,
      ],
      [
        'a variable reassigned from a literal to a computed value before the call',
        () => `$n='safe'; $n = Get-Content -Raw a.md; node -e ${NODE_WRITE} a.md $n`,
      ],
    ])('denies %s', (_label, command) => {
      const { status, stdout, stderr } = runCommand(command);
      expect(status, stderr).toBe(0);
      expect(stdout, 'expected a deny decision').not.toBe('');
      const output = JSON.parse(stdout).hookSpecificOutput;
      expect(output.hookEventName).toBe('PreToolUse');
      expect(output.permissionDecision).toBe('deny');
      // The reason names the shape, and what to use instead.
      expect(output.permissionDecisionReason).toMatch(/command-line argument/);
      expect(output.permissionDecisionReason).toMatch(/\bEdit\b/);
    });

    it.each([
      [
        'an inline write script whose only $var argument was literal-assigned (a scratchpad path)',
        () =>
          `$s='C:\\Users\\u\\AppData\\Local\\Temp\\claude\\C--x\\0f9e\\scratchpad'; node -e "require('fs').writeFileSync(process.argv[1], 'rows')" "$s\\rows.txt"`,
      ],
      [
        'an inline write script whose $var arguments were all literal-assigned',
        () => `$p='a.md'; $q="b.md"; node -e ${NODE_WRITE} $p $q`,
      ],
      [
        'an inline python write script with a literal-assigned $var',
        () =>
          `$p='out.txt'; python -c "import sys; open(sys.argv[1], 'w').write('x')" $p`,
      ],
      ['node script.mjs $n', () => `$n = Get-Content -Raw a.md; node script.mjs $n`],
      [
        'node with a script file and a $(...) argument',
        () => `node scripts/x.mjs $(Get-Content -Raw a.md)`,
      ],
      [
        'node -e "console.log(1)" $n',
        () => `$n = Get-Content -Raw a.md; node -e "console.log(1)" $n`,
      ],
      [
        'an inline python script that only reads',
        () =>
          `$n = Get-Content -Raw a.md; python -c "import sys; print(open(sys.argv[1]).read())" $n`,
      ],
      [
        'an inline write script with no variable argument',
        () => `node -e "require('fs').writeFileSync('out.txt', 'x')"`,
      ],
    ])('allows %s', (_label, command) => {
      const { status, stdout, stderr } = runCommand(command);
      expect(status).toBe(0);
      expect(stdout).toBe('');
      expect(stderr).toBe('');
    });

    // Review decisions, round 1 (findings 1a, 1b, 1d and 1f): content that
    // reaches the write script by another route than a bare computed `$var`.
    const COMPUTED = `$c = Get-Content -Raw a.md; `;
    it.each([
      // 1a: a parenthesized expression argument.
      [
        'a (Get-Content -Raw ...) argument',
        () => `node -e ${NODE_WRITE} a.md (Get-Content -Raw a.md)`,
      ],
      [
        'a ([IO.File]::ReadAllText(...)) argument',
        () => `$f='a.md'; node -e ${NODE_WRITE} $f ([IO.File]::ReadAllText($f))`,
      ],
      [
        "a ($c.Replace('a','b')) argument",
        () => `${COMPUTED}node -e ${NODE_WRITE} a.md ($c.Replace('a','b'))`,
      ],
      [
        'the 2026-10-07 incident with the replacement inlined in parentheses',
        () =>
          `$f='src/content/x/y.md'; $c=[IO.File]::ReadAllText($f); ` +
          `if ($c.Contains('x')) { node -e ${NODE_WRITE} $f ($c.Replace('x','y')) }`,
      ],
      // 1b: a double-quoted assignment that expands computed content.
      [
        'a $var assigned a double-quoted string expanding a computed $var',
        () => `${COMPUTED}$n = "$c\`n- a new row"; node -e ${NODE_WRITE} a.md $n`,
      ],
      [
        'a $var assigned a double-quoted string with a $(...) subexpression',
        () => `${COMPUTED}$n = "$($c.Trim())"; node -e ${NODE_WRITE} a.md $n`,
      ],
      // 1d: a computed $var expanded into the double-quoted script itself.
      [
        'a computed $var interpolated into a double-quoted write script',
        () => `${COMPUTED}node -e "require('fs').writeFileSync('a.md', '$c')"`,
      ],
      // 1f: other flag spellings.
      [
        'node --eval=<script> with a computed $var',
        () => `$n = Get-Content -Raw a.md; node --eval=${NODE_WRITE} a.md $n`,
      ],
      [
        'node -pe with a computed $var',
        () => `$n = Get-Content -Raw a.md; node -pe ${NODE_WRITE} a.md $n`,
      ],
    ])('denies %s', (_label, command) => {
      const { status, stdout, stderr } = runCommand(command);
      expect(status, stderr).toBe(0);
      expect(stdout, 'expected a deny decision').not.toBe('');
      const output = JSON.parse(stdout).hookSpecificOutput;
      expect(output.permissionDecision).toBe('deny');
      expect(output.permissionDecisionReason).toMatch(/command-line argument/);
      expect(output.permissionDecisionReason).toMatch(/\bEdit\b/);
    });

    it.each([
      [
        'a $var assigned a double-quoted string with nothing to expand',
        () => `$n = "hello"; node -e ${NODE_WRITE} a.md $n`,
      ],
      [
        'a $var assigned a double-quoted string expanding only a literal-assigned $var',
        () =>
          `$s='C:\\x'; $p="$s\\rows.txt"; node -e "require('fs').writeFileSync(process.argv[1], 'rows')" $p`,
      ],
      [
        'a single-quoted write script holding $c (no expansion)',
        () => `${COMPUTED}node -e 'require("fs").writeFileSync("a.md", "$c")'`,
      ],
      [
        'a double-quoted write script expanding only a literal-assigned $var',
        () => `$p='out.txt'; node -e "require('fs').writeFileSync('$p', 'x')"`,
      ],
    ])('allows %s', (_label, command) => {
      const { status, stdout, stderr } = runCommand(command);
      expect(status).toBe(0);
      expect(stdout).toBe('');
      expect(stderr).toBe('');
    });

    // Re-review finding 2: PowerShell 5.1 strips embedded double quotes from
    // a native argument, so literal text holding a double quote or a newline
    // is altered on the way in too.
    it.each([
      [
        'a here-string argument holding a double quote',
        () => `node -e ${NODE_WRITE} a.md @'\nline one\nHe said "hi"\n'@`,
      ],
      [
        'a single-quoted argument holding a double quote',
        () => `node -e ${NODE_WRITE} a.md 'He said "hi"'`,
      ],
      [
        'a literal-assigned $var holding a double quote',
        () => `$n = 'He said "hi"'; node -e ${NODE_WRITE} a.md $n`,
      ],
      [
        'a single-quoted argument holding a newline',
        () => `node -e ${NODE_WRITE} a.md 'line one\nline two'`,
      ],
    ])('denies %s', (_label, command) => {
      const { status, stdout, stderr } = runCommand(command);
      expect(status, stderr).toBe(0);
      expect(stdout, 'expected a deny decision').not.toBe('');
      const output = JSON.parse(stdout).hookSpecificOutput;
      expect(output.permissionDecision).toBe('deny');
      expect(output.permissionDecisionReason).toMatch(/command-line argument/);
      expect(output.permissionDecisionReason).toMatch(/\bEdit\b/);
    });

    it.each([
      [
        'a single-quoted path-like argument',
        () => `node -e ${NODE_WRITE} a.md 'C:\\x\\rows.txt'`,
      ],
      [
        'a double-quoted path expanding a literal-assigned $var',
        () => `$s='C:\\x'; node -e ${NODE_WRITE} a.md "$s\\rows.txt"`,
      ],
      ['a -- argument', () => `node -e ${NODE_WRITE} -- a.md b.md`],
      [
        'a foreach loop variable (fails open)',
        () =>
          `$f='a.md'; foreach ($line in 'a b;', 'c') { node -e ${NODE_WRITE} $f $line }`,
      ],
    ])('allows %s', (_label, command) => {
      const { status, stdout, stderr } = runCommand(command);
      expect(status).toBe(0);
      expect(stdout).toBe('');
      expect(stderr).toBe('');
    });

    it('allows the incident command from the Bash tool', () => {
      const { status, stdout } = runCommand(() => INCIDENT, 'Bash');
      expect(status).toBe(0);
      expect(stdout).toBe('');
    });

    it('decides the incident command in under a second', () => {
      const { stdout, ms } = runCommand(() => INCIDENT);
      expect(stdout).toContain('deny');
      expect(ms).toBeLessThan(1000);
    });
  });

  it('allows a Bash tool call, even one that writes', () => {
    const { status, stdout } = runCommand(() => 'echo a > docs/z.md', 'Bash');
    expect(status).toBe(0);
    expect(stdout).toBe('');
  });

  // Criterion 7: it fails open, quietly and fast.
  it.each([
    ['malformed JSON', '{"tool_name": "PowerShell", '],
    ['empty input', ''],
    ['no tool_input', JSON.stringify({ tool_name: 'PowerShell', cwd: tmpdir() })],
    [
      'a command that is not a string',
      JSON.stringify({
        tool_name: 'PowerShell',
        cwd: tmpdir(),
        tool_input: { command: 7 },
      }),
    ],
  ])('allows %s without throwing', (_label, stdin) => {
    const { status, stdout, stderr } = hook(stdin);
    expect(status).toBe(0);
    expect(stdout).toBe('');
    expect(stderr).toBe('');
  });

  it('decides in under a second', () => {
    const deny = runCommand(() => 'Set-Content docs\\x.md "a"');
    const allow = runCommand(() => 'Get-Content README.md');
    expect(deny.stdout).toContain('deny');
    expect(deny.ms).toBeLessThan(1000);
    expect(allow.ms).toBeLessThan(1000);
  });
});
