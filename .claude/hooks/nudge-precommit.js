// PreToolUse hook (Bash and PowerShell): reminds the session to check for stale
// documentation right before a git commit/push — the one point that's
// universal across every kind of change (unlike the SDLC-routing nudge
// in nudge-sdlc.js, which only fires on specific file paths and so never
// catches drift introduced by direct/small edits). It stays quiet only when
// every changed path is published content (CONTENT_PATH), which no doc
// describes; if git can't say what the change touches, it reminds anyway. Never blocks. Never throws past its own
// try/catch and always exits 0.
import { execFileSync } from 'node:child_process';

const REMINDER =
  "Reminder (docs/SDLC.md, evals/README.md): you're about to commit or " +
  'push. Before finalizing, consider whether anything in this change ' +
  'makes CLAUDE.md, README.md, a doc under docs/, or a SKILL.md ' +
  'inaccurate or incomplete — a new command, convention, section, or ' +
  "skill that isn't reflected anywhere, or an old fact that no longer " +
  'holds. For anything more than a small, obvious fix, consider running ' +
  'the docs-audit skill first.';

const GIT_SHIP_COMMAND = /(^|[;&|]|\s)git\s+(commit|push)(\s|$)/;
const GIT_PUSH = /(^|[;&|]|\s)git\s+push(\s|$)/;
const CONTENT_PATH = /^src\/(content|system-design\/case-studies)\//;

function git(cwd, args) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
    timeout: 5000,
  })
    .split('\n')
    .filter(Boolean);
}

// Paths the commit or push could ship. A commit counts working-tree and
// untracked changes too, since `git add … && git commit` or `commit -a` stages
// them after this hook runs. Returns null when git can't tell.
function changedPaths(cwd, command) {
  try {
    if (GIT_PUSH.test(command) && !/git\s+commit/.test(command)) {
      try {
        return git(cwd, ['diff', '--name-only', '@{upstream}...HEAD']);
      } catch {
        return git(cwd, ['diff', '--name-only', 'origin/main...HEAD']);
      }
    }
    return [
      ...git(cwd, ['diff', '--name-only', 'HEAD']),
      ...git(cwd, ['ls-files', '--others', '--exclude-standard']),
    ];
  } catch {
    return null;
  }
}

let data = '';
process.stdin.on('data', (chunk) => {
  data += chunk;
});
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(data);
    const command = (input.tool_input && input.tool_input.command) || '';
    if (GIT_SHIP_COMMAND.test(command)) {
      const cwd = input.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd();
      const paths = changedPaths(cwd, command);
      if (paths === null || !paths.every((p) => CONTENT_PATH.test(p))) {
        process.stdout.write(
          JSON.stringify({
            hookSpecificOutput: {
              hookEventName: 'PreToolUse',
              additionalContext: REMINDER,
            },
          }),
        );
      }
    }
  } catch {
    // Malformed/missing stdin — say nothing, never block.
  }
  process.exit(0);
});
