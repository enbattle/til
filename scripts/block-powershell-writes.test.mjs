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
