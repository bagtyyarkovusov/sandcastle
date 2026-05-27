# Session ID resilience + storage hardening

## Parent

`plans/issues/006-prd-kimi-provider-parity.md`

## What to build

Make session-ID extraction resilient to Kimi CLI wording changes, and harden session transfer so a single malformed JSONL line does not crash the entire transfer.

This slice cuts through the Kimi parser layer (session-ID regex patterns), the session storage layer (transfer JSONL parsing), and the test layer.

End-to-end behavior: when Kimi prints a session resume hint, Sandcastle recognizes it even if the wording differs slightly from today's exact string. When transferring a session between host and sandbox, a single corrupted JSONL entry is skipped and the rest of the file is transferred successfully.

For session-ID extraction, replace the single regex `^To resume this session: kimi -r (\S+)` with an ordered list of patterns tried in sequence. For session transfer, wrap each `JSON.parse` in the JSONL loop with a try/catch that logs the malformed line via `StreamLineTelemetry` and continues.

## Acceptance criteria

- [x] Kimi parser tries multiple ordered regex patterns for session-ID extraction
- [x] At least two patterns are defined: the current exact wording and a looser fallback
- [x] Session transfer loops over JSONL lines with per-line try/catch, skipping malformed entries
- [x] Skipped malformed lines are preserved unchanged (no data loss)
- [x] `AgentProvider.test.ts` verifies session-ID extraction with multiple wording variants
- [x] Session store tests verify transfer survives a malformed JSONL line

## Blocked by

None — can start immediately
