# Add parseSessionUsage for Kimi Code

**Status**: Done (Kimi does not expose usage data — parseSessionUsage stays undefined)
**Type**: AFK
**Blocked by**: Issue 002 (needs to know if Kimi exposes usage data)
**User stories**: 3

## What to build

If Issue 002 finds that Kimi emits token usage data in its stream or session files, implement `parseSessionUsage` on the Kimi Code provider to extract `inputTokens`, `cacheCreationInputTokens`, `cacheReadInputTokens`, and `outputTokens` per iteration, surfacing them in the terminal display and log output.

If Kimi's CLI does not expose usage data, skip this issue — it's optional, same as codex and pi.

## Acceptance criteria

- [x] If Kimi exposes usage: `parseSessionUsage` is defined on `kimiCode()` return value
- [x] If Kimi exposes usage: extracts `inputTokens`, `outputTokens`, and cache fields from session content
- [x] If Kimi exposes usage: tests verify extraction from representative session content
- [x] If Kimi does NOT expose usage: `parseSessionUsage` remains undefined (no-op)

## Blocked by

- Issue 002: Verify Kimi CLI resume and storage layout
