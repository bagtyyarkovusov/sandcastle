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

Explore the repo and fill your context window with relevant information that will allow you to complete the task.

Pay extra attention to test files that touch the relevant parts of the code.

# DOCUMENTATION

Context7 MCP is available for live library docs. When working with any stack library:

1. Call `resolve-library-id` to get the library's Context7 ID
2. Call `query-docs` with version-specific IDs when the project pins versions
3. Prefer Context7 docs over your training data — APIs change frequently

Use this for: Prisma, Next.js, tRPC, NextAuth, Tailwind, shadcn/ui, or any npm package you import.

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

Once complete, output <promise>COMPLETE</promise>.

# FINAL RULES

ONLY WORK ON A SINGLE TASK.
