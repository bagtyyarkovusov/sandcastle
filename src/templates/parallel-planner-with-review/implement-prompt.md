# TASK

Fix issue {{TASK_ID}}: {{ISSUE_TITLE}}

Pull in the issue using `{{VIEW_TASK_COMMAND}}`. If it has a parent PRD, pull that in too.

Only work on the issue specified.

Work on branch {{BRANCH}}. Make commits and run tests.

# CONTEXT

Here are the last 10 commits:

<recent-commits>

!`git log -n 10 --format="%H%n%ad%n%B---" --date=short`

</recent-commits>

If this project has a `docs/adr/` directory, read any ADRs relevant to the area you're touching before making architectural decisions.

# EXPLORATION

Use `{{VIEW_TASK_COMMAND}}` to read the issue. If it has a parent PRD (check the "Depends on" line), pull the parent PRD too and read it fully before you start — it contains the architecture, testing strategy, and module decisions for this slice.

If you encounter unfamiliar libraries or need current API docs, use Context7: call `resolve-library-id` with the library name, then `query-docs` with your question.

Explore the repo and fill your context window with relevant information that will allow you to complete the task.

Pay extra attention to test files that touch the relevant parts of the code.

# EXECUTION

If applicable, use RGR to complete the task.

1. RED: write one test
2. GREEN: write the implementation to pass that test
3. REPEAT until done
4. REFACTOR the code

# FEEDBACK LOOPS

Before committing, run `npm run typecheck` and `npm run test` to ensure the tests pass.

# COMMIT

Make a git commit. The commit message must:

1. Start with `RALPH:` prefix
2. Include task completed + PRD reference
3. Key decisions made
4. Files changed
5. Blockers or notes for next iteration

Keep it concise.

# THE ISSUE

If the task is not complete, leave a comment on the issue with what was done.

Do not close the issue - this will be done later.

# BUILD VERIFICATION RULES (MANDATORY)

- NEVER run `next dev`, `expo start`, `npm run dev`, or any long-running dev server.
  These block indefinitely and have no place in a sandbox environment.
- To verify Next.js code: `pnpm --filter web build` or `pnpm --filter admin build`
- To verify Expo mobile code: `pnpm --filter mobile lint` or `pnpm --filter mobile export:web`
- To verify API code: `pnpm --filter api build` and `pnpm --filter api test`
- To verify types across the entire monorepo: `pnpm typecheck` (from root)
- Always run the narrowest check first (`pnpm --filter <app> build`), then the
  monorepo-wide `pnpm typecheck` before finishing.
- NEVER commit `.env`, `.env.local`, or `.env.*.local` files.
- If you introduce a new required env var, add it to the app's `.env.template`
  (which IS tracked) so developers know it's needed. Do NOT put real values in
  `.env.template` — only key names and comments.

# CONTAINER LIMITATIONS

You are running inside a Linux Docker container. You DO NOT have:

- Docker daemon access (cannot build Docker images or run containers)
- macOS / Xcode (cannot build iOS apps)
- Android SDK (cannot build Android APKs)
- Ability to run long-running dev servers (Metro, Next.js dev, etc. block forever)

You DO have:

- Node.js 22, pnpm, git, curl, jq
- Full access to the monorepo code
- Ability to run builds, typecheck, lint, and unit tests
- Context7 MCP for querying library docs

Work within these constraints. Do not attempt to use tools that are not available.

# SPRINT CONTEXT

Before starting work, read the issue fully using {{VIEW_TASK_COMMAND}}. If the
issue body has a "Read first" section mentioning a sprint spec (e.g.
`docs/prd/sprints/sprint-01-scaffold.md`), read that file first. It contains the
acceptance criteria and architecture decisions for this sprint.

Once complete, output <promise>COMPLETE</promise>.

# FINAL RULES

ONLY WORK ON A SINGLE TASK.
