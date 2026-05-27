# Add parseSessionUsage for Kimi Code

**Status**: Done (best-effort method defined; returns `undefined` when Kimi session JSONL lacks token fields — confirmed in Issue 002)
**Type**: AFK
**Blocked by**: Issue 002 (needs to know if Kimi exposes usage data)
**User stories**: 3

## What to build

If Issue 002 finds that Kimi emits token usage data in its stream or session files, implement `parseSessionUsage` on the Kimi Code provider to extract `inputTokens`, `cacheCreationInputTokens`, `cacheReadInputTokens`, and `outputTokens` per iteration, surfacing them in the terminal display and log output.

If Kimi's CLI does not expose usage data, implement `parseSessionUsage` as best-effort: defined on the provider, returns `undefined` when token fields are absent (same forward-compat pattern as fixture tests in `AgentProvider.test.ts`).

## Acceptance criteria

- [x] `parseSessionUsage` is defined on `kimiCode()` return value
- [x] Extracts `inputTokens`, `outputTokens`, and cache fields from session content when present
- [x] Tests verify extraction from representative fixture session content
- [x] Returns `undefined` when Kimi session JSONL lacks token fields (production behavior per Issue 002)

## Blocked by

- Issue 002: Verify Kimi CLI resume and storage layout
