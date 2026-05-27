# Kimi session usage extraction

## Parent

`plans/issues/006-prd-kimi-provider-parity.md`

## What to build

Implement `parseSessionUsage` on the Kimi agent provider so that token usage appears in `RunResult` after an iteration.

This slice cuts through the agent provider layer (adding `parseSessionUsage` to Kimi's factory), the session storage layer (reading `context.jsonl` from the host session store), and the orchestration layer (populating the `usage` field on `RunResult`).

End-to-end behavior: when a user runs Sandcastle with the Kimi agent and `captureSessions: true`, the resulting `RunResult` includes `input_tokens` and `output_tokens` extracted from the captured session file. If Kimi's session format does not yet store token counts, the method returns `undefined` and the limitation is documented inline.

Where possible, reuse the existing session-store helpers used by Claude Code rather than duplicating path-construction logic inline.

## Implementation note

`parseSessionUsage` is implemented as best-effort. Kimi session JSONL from production runs (Issue 002) does not yet contain token fields, so the method returns `undefined` in real usage. Fixture-based tests verify extraction when token fields are present.

## Acceptance criteria

- [x] Kimi agent provider exposes a `parseSessionUsage` method
- [x] The method reads the host session store's `context.jsonl` and extracts input/output token counts
- [x] If token fields are absent from the JSONL, the method returns `undefined` with a code comment explaining why
- [x] `AgentProvider.test.ts` verifies usage extraction from fixture session content
- [x] Fixture JSONL files represent Kimi session output for test cases
- [x] Edge cases tested: empty file, missing token fields, malformed JSONL

## Blocked by

None — can start immediately
