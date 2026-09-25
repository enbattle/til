// PreToolUse hook (Bash and PowerShell): reminds the session to check for stale
// documentation right before a git commit/push — the one point that's
// universal across every kind of change (unlike the SDLC-routing nudge
// in nudge-sdlc.js, which only fires on specific file paths and so never
// catches drift introduced by direct/small edits). Never blocks. Never
// throws past its own try/catch and always exits 0.
const REMINDER =
  "Reminder (docs/SDLC.md, evals/README.md): you're about to commit or " +
  'push. Before finalizing, consider whether anything in this change ' +
  'makes CLAUDE.md, README.md, a doc under docs/, or a SKILL.md ' +
  'inaccurate or incomplete — a new command, convention, section, or ' +
  "skill that isn't reflected anywhere, or an old fact that no longer " +
  'holds. For anything more than a small, obvious fix, consider running ' +
  'the docs-audit skill first.';

const GIT_SHIP_COMMAND = /(^|[;&|]|\s)git\s+(commit|push)(\s|$)/;

let data = '';
process.stdin.on('data', (chunk) => {
  data += chunk;
});
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(data);
    const command = (input.tool_input && input.tool_input.command) || '';
    if (GIT_SHIP_COMMAND.test(command)) {
      process.stdout.write(
        JSON.stringify({
          hookSpecificOutput: {
            hookEventName: 'PreToolUse',
            additionalContext: REMINDER,
          },
        }),
      );
    }
  } catch {
    // Malformed/missing stdin — say nothing, never block.
  }
  process.exit(0);
});
