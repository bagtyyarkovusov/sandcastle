# Enable captureSessions + wire resumeSession on KimiCode provider

**Status**: Done
**Type**: AFK
**Blocked by**: Issue 001 (ADR 0012 sessionStorage interface)
**User stories**: 1, 2, 4

## What to build

Add `captureSessions?: boolean` to `KimiCodeOptions` (default `true`, matching `ClaudeCodeOptions`). Wire `resumeSession` in `buildPrintCommand` — append `-r <sessionId>` when the option is set, composing correctly with `--print`, `--input-format stream-json`, `--output-format stream-json`, `--thinking`/`--no-thinking`, and `--model`. Update tests to verify the new behavior.

## Acceptance criteria

- [x] `KimiCodeOptions` gains `captureSessions?: boolean` field
- [x] `kimiCode()` factory returns `captureSessions: true` by default
- [x] `kimiCode("model", { captureSessions: false })` returns `captureSessions: false`
- [x] `buildPrintCommand` appends `-r <sessionId>` when `resumeSession` is set
- [x] `buildPrintCommand` does not include `-r` when `resumeSession` is not set
- [x] `-r` flag composes correctly with all other flags (thinking, model, stream-json)
- [x] Tests: default `captureSessions: true`, opt-out works, resume flag present/absent

## Blocked by

- Issue 001: ADR 0012 sessionStorage interface (needs the `sessionStorage` field on `AgentProvider`)
