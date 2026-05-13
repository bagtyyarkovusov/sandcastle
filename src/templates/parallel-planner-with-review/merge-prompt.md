# TASK

Merge the following branches into the current branch:

{{BRANCHES}}

For each branch:

1. Run `git merge <branch> --no-edit`
2. If there are merge conflicts, resolve them intelligently by reading both sides and choosing the correct resolution
3. After resolving conflicts, run `npm run typecheck` and `npm run test` to verify everything works
4. If tests fail, fix the issues before proceeding to the next branch

After all branches are merged, make a single commit summarizing the merge.

# CLOSE ISSUES

For each branch that was merged, close its issue using the following command:

`{{CLOSE_TASK_COMMAND}}`

Here are all the issues:

{{ISSUES}}

# ISSUE HIERARCHY ANALYSIS

Before closing any issues, you MUST understand the dependency graph:

1. Fetch ALL open issues: `gh issue list --state open --json number,title,body,labels`
2. For each open issue, scan its body for "Depends on #<number>" references
3. Build a map of which issues are blocked by which

# SAFE UNBLOCKING RULE

After closing an issue with {{CLOSE_TASK_COMMAND}}, only remove the `blocked` label
from another issue if ALL of its "Depends on" references now point to CLOSED issues.

Command to remove blocked label: `gh issue edit <id> --remove-label blocked`

If an issue depends on multiple issues and only one was closed, DO NOT unblock it.

# MONOREPO BUILD COMMANDS

This project uses pnpm, not npm. Use these commands instead of `npm run ...`:

- `pnpm typecheck` — typecheck all packages
- `pnpm --filter <app> build` — build a specific app
- `pnpm --filter <app> test` — test a specific app

# HOST ACCESS CAPABILITIES

You operate on the main branch with full host access. Unlike the implementer,
you have:

- Docker daemon access (can build images, run containers via `docker`)
- Ability to start the full local stack (`pnpm compose:up`, `pnpm dev`)
- Network access to host services (use `host.docker.internal` for host-bound services)
- Full integration and E2E testing capabilities

Use these capabilities to thoroughly validate the merged code. Run smoke tests,
build Docker images if infrastructure changed, and verify the stack comes up
cleanly before finishing.

# SUMMARY

After merging, output:

- Which issues were merged and closed
- Which issues were unblocked (blocked label removed)
- Which issues remain blocked and why

Once you've merged everything you can, output <promise>COMPLETE</promise>.
