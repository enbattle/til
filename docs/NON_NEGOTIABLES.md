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

5. No secrets in the repository, and nothing that reads `.env` files.
6. Markdown never renders raw HTML (no `rehype-raw`); `dangerouslySetInnerHTML` only takes output from an escaping source (Shiki).
7. External links open with `rel="noreferrer"`; no third-party scripts at runtime.

**Process**

8. The test-writer, implementer and reviewer are separate, fresh agents, never a `fork` or a skill invoked for review (docs/SDLC.md).
9. Tests locked after Stage 2 change only through a fresh test-writer; `check:test-lock` enforces it.
10. Gates are checks the orchestrator runs itself, never a subagent's self-report.
11. Nothing is committed or pushed without the user's explicit go-ahead.
12. Every loop is capped (2 review rounds) and surfaces to the user when the cap is hit.
