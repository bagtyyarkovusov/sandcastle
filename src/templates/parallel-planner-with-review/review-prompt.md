# TASK

Review the code changes on branch `{{BRANCH}}` and improve code clarity, consistency, and maintainability while preserving exact functionality.

# CONTEXT

## Branch diff

!`git diff {{SOURCE_BRANCH}}...{{BRANCH}}`

## Commits on this branch

!`git log {{SOURCE_BRANCH}}..{{BRANCH}} --oneline`

# REVIEW PROCESS

1. **Understand the change**: Read the diff and commits above to understand the intent.

2. **Analyze for improvements**: Look for opportunities to:
   - Reduce unnecessary complexity and nesting
   - Eliminate redundant code and abstractions
   - Improve readability through clear variable and function names
   - Consolidate related logic
   - Remove unnecessary comments that describe obvious code
   - Avoid nested ternary operators - prefer switch statements or if/else chains
   - Choose clarity over brevity - explicit code is often better than overly compact code

3. **Check correctness**:
   - Does the implementation match the intent? Are edge cases handled?
   - Are new/changed behaviours covered by tests?
   - Are there unsafe casts, `any` types, or unchecked assumptions?
   - Does the change introduce injection vulnerabilities, credential leaks, or other security issues?
   - Does the change respect any relevant ADRs in `docs/adr/`?
   - If the change uses libraries or frameworks, verify the implementation against current docs — use Context7 (`resolve-library-id` / `query-docs`) if something looks off or uses deprecated APIs.

4. **Maintain balance**: Avoid over-simplification that could:
   - Reduce code clarity or maintainability
   - Create overly clever solutions that are hard to understand
   - Combine too many concerns into single functions or components
   - Remove helpful abstractions that improve code organization
   - Make the code harder to debug or extend

5. **Apply project standards**: Follow the coding standards defined in @.sandcastle/CODING_STANDARDS.md

6. **Preserve functionality**: Never change what the code does - only how it does it. All original features, outputs, and behaviors must remain intact.

# EXECUTION

If you find improvements to make:

1. Make the changes directly on this branch
2. Run tests and type checking to ensure nothing is broken
3. Commit describing the refinements

# CONTAINER LIMITATIONS

Both the implementer and reviewer run inside the same Linux Docker container.
The code must work without:

- Docker, iOS/Android native builds, or long-running dev servers
- Host services or external APIs not available in the container

Verify the implementation respects these constraints.

# MERGE GATE CHECKLIST

Before approving this branch for merge, verify ALL of the following:

1. `pnpm typecheck` passes with zero errors across all packages
2. Relevant app builds pass (`pnpm --filter <modified-app> build`)
3. Relevant tests pass (`pnpm --filter <modified-app> test`)
4. No `.env`, `.env.local`, or secrets files were added to git
5. `pnpm-lock.yaml` is updated if any `package.json` changed
6. No generated directories (`.next/`, `.expo/`, `android/`, `ios/`) were committed
7. The change respects relevant ADRs in `docs/adr/`

If ANY check fails, REJECT the merge and output the exact errors. Do not approve.

If the code is already clean and well-structured, do nothing.

Once complete, output <promise>COMPLETE</promise>.
