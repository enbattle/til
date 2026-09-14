// PreToolUse hook (Edit|Write): reminds the session to check this repo's
// SDLC guidance before editing app code, a spec, or the SDLC tooling
// itself — without blocking the edit. Never throws past its own
// try/catch and always exits 0 — a bug here must never break a normal
// Edit/Write call.
const ROUTING_REMINDER =
  'Reminder (CLAUDE.md): for a nontrivial app-code change, use the /feature ' +
  'skill (spec -> TDD -> implementation -> review). For adding a new topic ' +
  'markdown file to an existing section under src/content/, use the ' +
  'add-topic skill. Genuinely small, unambiguous changes (a typo, a ' +
  "one-line fix) can skip both, per CLAUDE.md's own carve-out.";

const EVALS_REMINDER =
  "Reminder (docs/SDLC.md): you're editing this repo's SDLC tooling " +
  'itself (CLAUDE.md, docs/SDLC.md, a skill, or a hook). Consider running ' +
  'the skill-routing-eval skill afterward (see evals/README.md) — ' +
  'routing drift from a wording change here is otherwise invisible ' +
  'until it shows up in real use.';

function isAppCodeOrSpec(path) {
  return /(^|\/)src\//.test(path) || /(^|\/)docs\/specs\//.test(path);
}

function isSdlcTooling(path) {
  return (
    /(^|\/)CLAUDE\.md$/.test(path) ||
    /(^|\/)docs\/SDLC\.md$/.test(path) ||
    /(^|\/)\.claude\/skills\//.test(path) ||
    /(^|\/)\.claude\/hooks\//.test(path)
  );
}

let data = '';
process.stdin.on('data', (chunk) => {
  data += chunk;
});
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(data);
    const filePath = (input.tool_input && input.tool_input.file_path) || '';
    const normalized = filePath.replace(/\\/g, '/');

    const reminders = [];
    if (isAppCodeOrSpec(normalized)) reminders.push(ROUTING_REMINDER);
    if (isSdlcTooling(normalized)) reminders.push(EVALS_REMINDER);

    if (reminders.length > 0) {
      process.stdout.write(
        JSON.stringify({
          hookSpecificOutput: {
            hookEventName: 'PreToolUse',
            additionalContext: reminders.join('\n\n'),
          },
        }),
      );
    }
  } catch {
    // Malformed/missing stdin — say nothing, never block.
  }
  process.exit(0);
});
