# PRD: Core Edge-Case Hardening

## Problem Statement

Sandcastle's orchestration layer has several critical edge cases where failures are silent, errors bypass the friendly error handler, or race conditions can produce incorrect results. When a `StructuredOutputError` occurs, it is thrown synchronously outside the Effect runtime — bypassing log writing, worktree-path attachment, and formatted error messages. When `syncOut` partially applies artifacts (commits succeed but diff fails), the host repository is left in a modified state with no rollback. When the abort signal races with agent completion, the iteration may report failure despite the agent having succeeded. When a stream parser encounters an unrecognized line, it is silently dropped with no observability. These gaps erode trust in the tool and make production usage risky.

## Solution

Harden the core orchestration layer against the highest-impact edge cases: integrate `StructuredOutputError` into the friendly error handling path, add partial-rollback to `syncOut`, fix the abort/completion race in the Orchestrator, warn on missing `copyToWorktree` paths, and add debug-level telemetry for dropped stream lines across all agent providers.

## User Stories

1. As a Sandcastle user using structured output, I want schema-validation failures to produce the same formatted error message as other sandbox errors, so that I can read the error instead of receiving a raw stack trace.
2. As a Sandcastle user using structured output, I want validation failures to preserve the worktree path in the error output, so that I can inspect the agent's partial work.
3. As a Sandcastle user, I want `syncOut` failures to leave my host repository in a clean state if possible, so that a failed iteration does not leave half-applied commits or patches on my working branch.
4. As a Sandcastle user, I want the abort signal to reliably terminate an iteration without masking a successful agent exit, so that I can trust the run result.
5. As a Sandcastle user, I want to be warned when a path in `copyToWorktree` does not exist, so that typos in my configuration are caught early instead of silently ignored.
6. As a Sandcastle user debugging a failed iteration, I want unrecognized lines from the agent's stdout to be logged at debug level, so that I can see what the parser dropped.
7. As a Sandcastle user, I want the idle timeout to not falsely fire after the agent has already exited, so that I don't see spurious timeout errors.
8. As a Sandcastle user running merge-to-head, I want stash-pop failures to be surfaced explicitly, so that I know my host changes are still in the stash.
9. As a Sandcastle user, I want empty patches from merge commits to be handled correctly during `syncOut`, so that commits consisting only of merges are not silently lost.
10. As a Sandcastle developer, I want the `ErrorHandler` switch statement to be generated or linted against the `SandboxError` union, so that it cannot drift out of sync when new error types are added.
11. As a Sandcastle user running concurrent hooks, I want a hook failure to cancel sibling hooks and surface the error, so that failures are not hidden behind successful siblings.
12. As a Sandcastle user, I want `git rev-list` failures during commit collection to produce an error rather than returning an empty commits array, so that I know when the tool failed to read git history.

## Implementation Decisions

- **`StructuredOutputError` will be caught inside the Effect runtime**. Instead of throwing synchronously in `run.ts` after `Effect.runPromise`, the extraction will be wrapped in `Effect.sync` and composed into the main Effect program. This ensures `withFriendlyErrors` formats the message, the log file receives the error, and `preservedWorktreePath` is attached.
- **`syncOut` will gain a rollback mechanism**. If the three-phase apply (commits → diff → untracked) fails at any step after earlier steps succeeded, the already-applied changes will be reverted using `git reset --hard` to the state before `syncOut` began. The recovery message will still be printed, but the host repo will be clean. A new `SyncOutRollbackError` may be introduced if rollback itself fails.
- **The Orchestrator's abort/timeout race will be fixed**. Instead of `Effect.raceFirst` between `execEffect`, `timeoutSignal`, and `abortDeferred`, the completion will use `Effect.race` with explicit winner detection: if `execEffect` completes, the timeout and abort deferreds are completed harmlessly. If timeout or abort wins, the agent process is killed before returning. This eliminates the window where a late timeout fires after successful completion.
- **`copyToWorktree` will warn on missing paths**. Instead of silently `continue`-ing when `existsSync(src)` is false, the module will emit a warning through the Display service (or console.warn in test contexts) with the exact path that was skipped.
- **A shared `StreamLineTelemetry` module will log dropped lines at debug level**. Every agent provider's `parseStreamLine` will delegate unrecognized lines to this module. The module logs via the Display service's debug channel, which is a no-op in terminal mode but writes to the run log in log-to-file mode.
- **The idle timeout cleanup will be hardened**. The `setTimeout` callback will check a `hasCompleted` flag before firing the `Deferred.fail`, ensuring that if the agent exits in the same event loop tick as the timeout, the timeout is ignored.
- **Stash-pop failures will be surfaced**. Instead of silently swallowing `git stash pop` failures in `SandboxLifecycle.ts`, a warning will be emitted through the Display service indicating that host changes remain in the stash.
- **`git rev-list` failures during commit collection will fail the iteration**. Instead of returning `[]` on any git error, the code will propagate a `CommitCollectionTimeoutError` or `SyncError` so the user knows commit collection failed.
- **Empty patch detection will be fixed**. The `isEmptyPatch` helper will be updated to recognize merge-commit patches (which have headers but no `diff --git` lines) as non-empty, so they are preserved and applied.
- **Hook concurrency will be bounded and cancellable**. Instead of `Effect.all(..., { concurrency: "unbounded" })`, hooks will use a bounded concurrency with `concurrency: 2` and `rejectOnFirstError: true`, so one hook failure cancels siblings and surfaces immediately.

## Testing Decisions

- **Good tests assert user-visible outcomes, not internal Effect wiring**. For `StructuredOutputError` integration, the test runs `run()` with a bad schema and asserts the error message is formatted and the worktree path is present. For `syncOut` rollback, the test sets up a host repo, simulates a partial apply failure, and asserts the repo is back to its original HEAD.
- **`Orchestrator.test.ts` will be extended** with race-condition tests: abort signal firing after agent completion, timeout firing after agent completion, and successful completion winning a race.
- **`syncOut.test.ts` will be extended** with partial-apply scenarios: commits succeed + diff fails, commits+diff succeed + untracked fails, and rollback verification.
- **`CopyToWorktree.test.ts` will be extended** with a missing-path test asserting a warning is emitted.
- **`AgentProvider.test.ts` will be extended** for each provider with an "unrecognized line" test asserting the telemetry module is called.
- **Prior art**: `syncOut.test.ts` already tests the happy path and some failure paths. `Orchestrator.test.ts` tests the iteration loop at the SandboxFactory level. `ErrorHandler.test.ts` tests error formatting.

## Out of Scope

- Provider-level retry logic (e.g., retrying Docker daemon hiccups) — see `.out-of-scope/provider-error-retry.md`.
- Worktree locking implementation — see ADR-0007.
- Windows-specific path handling improvements — see ADR-0006.
- Changes to the prompt pipeline (substitution, expansion, preprocessing).
- Changes to the branch strategy or worktree lifecycle beyond the specific fixes listed.

## Further Notes

- The `StructuredOutputError` integration is the highest-impact change because it affects every user of structured output across all agent providers.
- The `syncOut` rollback change is delicate because it touches git state on the host. Tests should use temporary git repositories and verify HEAD before and after.
- The abort/timeout race fix is subtle. The implementation should use `Effect.ensuring` or `Effect.onExit` to guarantee cleanup ordering rather than relying on `raceFirst` semantics.
- The `StreamLineTelemetry` module is shared with the Kimi Provider Parity PRD. If both PRDs are implemented, the module should be built once and reused.
