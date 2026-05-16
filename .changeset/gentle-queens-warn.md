---
"@ai-hero/sandcastle": patch
---

Kimi Provider Parity: robustness and observability improvements

- Added `error`, `agent_error`, and `result` event parsing to the Kimi stream parser
- Introduced shared `StreamLineTelemetry` module for debug logging of unrecognized stream lines across all agent providers
- Implemented `parseSessionUsage` for Kimi to extract token usage from captured sessions
- Separated `thinking` chunks from `text` chunks in terminal display and run logs
- Added `AgentStreamEvent` `thinking` variant for observability callbacks
- Hardened session-ID extraction with multiple fallback regex patterns
- Hardened session transfer to survive malformed JSONL lines
- Wired `dangerouslySkipPermissions` through to Kimi CLI's `--yolo` flag
