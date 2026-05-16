# ADR 0012: Add sessionStorage to AgentProvider interface

**Status**: Done
**Type**: AFK
**Blocked by**: None — can start immediately
**User stories**: 6

## What to build

Migrate the `AgentProvider` interface to include an optional `sessionStorage` sub-object as described in ADR 0012. Move the Orchestrator, `run.ts`, and `createWorktree.ts` from calling the free `hostSessionStore`/`sandboxSessionStore` functions to reading `provider.sessionStorage`. Wrap Claude Code's existing session store logic behind `claudeCode`'s new `sessionStorage` field, and move `transferSession` into the Claude Code provider (since cwd-rewrite is Claude-specific). Providers without `sessionStorage` (codex, pi) keep `captureSessions: false` and are unaffected.

## Acceptance criteria

- [x] `AgentProvider` interface gains optional `sessionStorage?: { hostStore, sandboxStore, transfer }`
- [x] `claudeCode` factory returns `sessionStorage` wrapping the existing free-function stores
- [x] `claudeCode`'s `sessionStorage.transfer` handles cwd-rewrite (moved from the free `transferSession`)
- [x] Orchestrator reads `provider.sessionStorage` instead of calling free functions directly
- [x] `run.ts` and `createWorktree.ts` read `provider.sessionStorage` instead of free functions
- [x] `codex` and `pi` providers are unchanged and continue with `captureSessions: false`
- [x] All existing tests pass; new tests cover `claudeCode`'s `sessionStorage` field presence
- [x] Free `hostSessionStore`/`sandboxSessionStore` remain exported (used by consumers) but are no longer called internally by the Orchestrator

## Blocked by

None — can start immediately.
