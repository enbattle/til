// @vitest-environment node
// Vectors for .claude/hooks/block-powershell-writes.js in its blunt form
// (docs/specs/in-process-checks.md, criterion 6). Windows PowerShell 5.1
// re-encodes what it writes and truncates native arguments, so the hook
// denies a PowerShell command that writes a file by text alone: no path or
// variable resolution, so a write to the scratchpad is denied too.
// text-encoding.test.ts stays the real gate.
//
// Interface assumed: the hook exports `denyReason(command)`, which returns the
// deny reason (a string) or null to allow. Importing it runs nothing. Run as
// a hook, it reads PreToolUse JSON on stdin and prints the deny JSON for a
// denied PowerShell command; anything else (another tool, malformed JSON, an
// error) is allowed: exit 0, no output.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { denyReason } from '../.claude/hooks/block-powershell-writes.js';

const HOOK = resolve('.claude/hooks/block-powershell-writes.js');

describe('block-powershell-writes', () => {
  describe('denies', () => {
    it.each([
      // The write cmdlets and their aliases, as a command word, in any case.
      'Set-Content a.txt x',
      'set-content a.txt x',
      'SET-CONTENT a.txt x',
      'x | Out-File a.md',
      'Add-Content -Path .\\README.md -Value b',
      '"a" | Tee-Object -FilePath log.txt',
      'sc a.txt x',
      'ac f y',
      '"x" | tee f',
      'Get-Date; Set-Content a.txt x',
      'x | Set-Content a.txt',
      // A command word inside a script block or statement block.
      '& { Set-Content a.txt x }',
      'if ($ok) { Out-File a.txt }',
      // A write to the scratchpad is denied too: nothing resolves paths.
      'Set-Content "$env:TEMP\\claude\\scratch.txt" x',
      // Redirections to anything but $null.
      'echo x > f.txt',
      'echo x >> f',
      'dir 2> err.txt',
      'x *> all.txt',
      'x 3>> warnings.txt',
      // .NET file writes.
      "[IO.File]::WriteAllText('a', 'b')",
      "[System.IO.File]::AppendAllText('a', 'b')",
      // An inline interpreter script that writes a file.
      `node -e "require('fs').writeFileSync('a', process.argv[1])" $t`,
      `node --eval "require('fs').appendFileSync('a', 'x')"`,
      `node -p "require('fs').createWriteStream('a')"`,
      `node --print "require('fs/promises').writeFile('a', 'x')"`,
      `python -c "open('a','w').write('x')"`,
      `python3 -c "open('a', 'a').write('x')"`,
      `python -c "open('notes.md', 'a')"`,
      `py -Ic "from pathlib import Path; Path('a').write_text('x')"`,
      `python -c "from pathlib import Path; Path('a').write_bytes(b'x')"`,
      // A quote of one kind inside a string of the other kind doesn't pair
      // with a later quote across commands (strings removed in one pass).
      `Write-Host "Writing the file's header"; Set-Content -Path 'notes.md' -Value $t`,
      `Write-Host 'say "hi"'; echo x > out.txt`,
      // A comment is removed in the same pass, so an apostrophe in it doesn't
      // pair with a quote in a later command.
      `# don't touch the header\nSet-Content out.md 'x'`,
      `Get-Date # it's late\necho x > f.txt`,
      `<# it's a block comment #> Set-Content a.txt 'x'`,
    ])('%s', (command) => {
      const reason = denyReason(command);
      expect(reason, command).toEqual(expect.any(String));
      // The reason says why and what to use instead.
      expect(reason).toMatch(/5\.1|encod|truncat/i);
      expect(reason).toMatch(/\b(Write|Edit|Bash)\b/);
    });
  });

  describe('allows', () => {
    it.each([
      'Get-Content a.md',
      'git status',
      'npm run verify',
      // Names inside quoted strings don't count.
      'Write-Output "a > b"',
      "Select-String 'Set-Content' file",
      "Write-Host 'echo x >> f'",
      // A quote of the other kind inside a string stays inside it.
      `Write-Host "it's fine"; Get-Content 'a.md'`,
      `Write-Host 'say "hi"'; Get-Content "a.md"`,
      // Discarded output and stream merges.
      'cmd 2>$null',
      'x > $null',
      'x *> $null',
      'x 2>&1 | Select-Object -First 5',
      'x | Out-Null',
      // An inline script that doesn't write, and a script file.
      'node -e "console.log(1)"',
      'node scripts/x.mjs',
      'python -c "print(1)"',
      // Review finding L6 (fix round 2): a cmdlet name that is an argument,
      // not the command word, and an open() whose only argument is a
      // one-letter filename (a write mode comes after a comma).
      'git grep -n Set-Content -- docs',
      `python -c "print(open('a').read())"`,
      // A comment's text doesn't count, and a # inside a string or a word
      // doesn't start one.
      'Get-Content a.md # then write it > later',
      `Write-Host "# Set-Content isn't run"; Get-Content 'a.md'`,
      "Write-Output 'a#b' > $null",
      // A word that only contains an alias.
      'Get-Process | Sort-Object CPU',
      'git describe --tags',
    ])('%s', (command) => {
      expect(denyReason(command)).toBeNull();
    });
  });

  it('is under 160 lines, comments included', () => {
    const lines = readFileSync(HOOK, 'utf8').replace(/\n$/, '').split('\n');
    expect(lines.length).toBeLessThan(160);
  });

  // The one run of the hook file: as Claude Code runs it, PreToolUse JSON on
  // stdin. A denied PowerShell command gets the deny JSON; the same command
  // from the Bash tool, and malformed JSON, are allowed with no output.
  it('runs as a PreToolUse hook: denies PowerShell, allows Bash and malformed JSON', () => {
    const hook = (input) =>
      spawnSync(process.execPath, [HOOK], { input, encoding: 'utf8' });
    const call = (tool) =>
      JSON.stringify({
        session_id: 'test',
        hook_event_name: 'PreToolUse',
        tool_name: tool,
        tool_input: { command: 'Set-Content docs\\x.md "a"' },
      });

    const denied = hook(call('PowerShell'));
    expect(denied.status, denied.stderr).toBe(0);
    const output = JSON.parse(denied.stdout).hookSpecificOutput;
    expect(output.hookEventName).toBe('PreToolUse');
    expect(output.permissionDecision).toBe('deny');
    expect(output.permissionDecisionReason).toBe(
      denyReason('Set-Content docs\\x.md "a"'),
    );

    for (const input of [call('Bash'), '{ not json']) {
      const allowed = hook(input);
      expect(allowed.status, allowed.stderr).toBe(0);
      expect(allowed.stdout.trim()).toBe('');
    }
  });
});
