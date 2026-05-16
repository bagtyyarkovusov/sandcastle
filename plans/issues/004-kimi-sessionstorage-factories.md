# Implement Kimi sessionStorage factories

**Status**: Done
**Type**: AFK
**Blocked by**: Issue 001 (interface), Issue 002 (empirical layout data)
**User stories**: 1, 2, 8

## What to build

Implement `hostStore`, `sandboxStore`, and `transfer` on the Kimi Code provider, using the session storage layout discovered in Issue 002. If Kimi's session format embeds the working directory, apply cwd rewrite in `transfer` (analogous to Claude Code's cwd-rewrite). If it does not, `transfer` is a plain copy between stores.

The host store reads/writes session files from Kimi's host-side session directory. The sandbox store uses bind-mount handle primitives (`copyFileIn`/`copyFileOut`) to transfer files across the sandbox boundary, following the same pattern as `sandboxSessionStore` in `SessionStore.ts`.

Wire `sessionStorage` into the `kimiCode()` factory return value so the Orchestrator can pick it up (via the interface added in Issue 001).

## Acceptance criteria

- [x] `kimiCode()` returns `sessionStorage` with `hostStore`, `sandboxStore`, and `transfer`
- [x] `hostStore` reads/writes session files from Kimi's host-side session directory
- [x] `sandboxStore` reads/writes via bind-mount handle primitives
- [x] `transfer` copies session content between stores, with cwd rewrite if applicable
- [x] Tests: round-trip write via hostStore → read back, content matches
- [x] Tests: write via hostStore → transfer to sandboxStore → read via sandboxStore, content preserved
- [x] Tests: transfer with cwd rewrite (if Kimi embeds cwd) correctly transforms the field

## Blocked by

- Issue 001: ADR 0012 sessionStorage interface
- Issue 002: Verify Kimi CLI resume and storage layout
