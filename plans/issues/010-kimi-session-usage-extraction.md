# Kimi session usage extraction

## Parent

`plans/issues/006-prd-kimi-provider-parity.md`

## What to build

Implement `parseSessionUsage` on the Kimi agent provider so that token usage appears in `RunResult` after an iteration.

This slice cuts through the agent provider layer (adding `parseSessionUsage` to Kimi's factory), the session storage layer (reading `context.jsonl` from the host session store), and the orchestration layer (populating the `usage` field on `RunResult`).

End-to-end behavior: when a user runs Sandcastle with the Kimi agent and `captureSessions: true`, the resulting `RunResult` includes `input_tokens` and `output_tokens` extracted from the captured session file. If Kimi's session format does not yet store token counts, the method returns `undefined` and the limitation is documented inline.

Where possible, reuse the existing session-store helpers used by Claude Code rather than duplicating path-construction logic inline.

## Acceptance criteria

- [ ] Kimi agent provider exposes a `parseSessionUsage` method
- [ ] The method reads the host session store's `context.jsonl` and extracts input/output token counts
- [ ] If token fields are absent from the JSONL, the method returns `undefined` with a code comment explaining why
- [ ] `Orchestrator.test.ts` or `AgentProvider.test.ts` verifies that a Kimi iteration with session capture reports usage
- [ ] Fixture JSONL files represent real Kimi session output for test cases
- [ ] Edge cases tested: empty file, missing token fields, malformed JSONL

## Blocked by

None — can start immediately
