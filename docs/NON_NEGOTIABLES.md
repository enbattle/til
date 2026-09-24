# Non-negotiables

Constraints, not suggestions. Every reviewer in this repo's skills is given
this file. If a spec conflicts with a line here, this file wins unless the
user explicitly amends it, and a stage that hits the conflict stops and says
so instead of choosing. Each line points to where the detail lives; the
detail is never copied here.

**Product**

1. Every UI change meets [DESIGN.md's accessibility checklist](DESIGN.md#accessibility-checklist), in both themes and at 375px width.
2. Colors come only from design tokens; `check:colors`, `check:tokens` and `check:contrast` stay green.
3. No bundle budget is raised silently; a raise is deliberate and recorded with measured numbers (CLAUDE.md, "Verifying a change").
4. Published prose meets CLAUDE.md's Writing Standard, including verified technical claims.

**Security**

5. No secrets in the repository or in `.env` files (Vite reads `.env` at build time, so anything there can end up in the bundle); agents never read `.env` files.
6. Markdown never renders raw HTML (no `rehype-raw`); `dangerouslySetInnerHTML` only takes output from an escaping source (Shiki). `check:raw-html` enforces both, and also rejects `innerHTML`, `outerHTML`, `insertAdjacentHTML` and `document.write` in app code.
7. External links open with `rel="noreferrer"` (`MarkdownRenderer.test.tsx` checks it); no third-party scripts at runtime.

**Process**

8. The test-writer, implementer and reviewer are separate, fresh agents, never a `fork` or a skill invoked for review (.claude/skills/feature/SKILL.md, rule 1 and Stage 4).
9. Tests locked after Stage 2 change only through a fresh test-writer; `check:test-lock` enforces it.
10. Gates are checks the orchestrator runs itself, never a subagent's self-report.
11. Nothing is committed or pushed without the user's explicit go-ahead.
12. Every loop in the skills has a cap stated where the loop is, and hitting it surfaces to the user rather than trying again.
