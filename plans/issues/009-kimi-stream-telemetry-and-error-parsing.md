# Shared stream-line telemetry + Kimi error/result parsing

## Parent

`plans/issues/006-prd-kimi-provider-parity.md`

## What to build

Introduce a shared `StreamLineTelemetry` module and wire it into every agent provider's `parseStreamLine`. Add `error`, `agent_error`, and `result` event parsing to the Kimi stream parser.

This slice cuts through the type layer (`ParsedStreamEvent`), the agent provider layer (Kimi parser + shared telemetry hook), the orchestration layer (result events populating `resultText`), the display layer (debug logging of unrecognized lines), and the test layer.

End-to-end behavior: when Kimi emits an error JSON line on stdout, the iteration fails and the error text surfaces in the `RunResult` via the existing `result` event path (mirroring Pi and Codex). When any provider's parser encounters a line it does not recognize, the line is logged at debug level through the Display service — visible in run logs when using log-to-file mode.

The `StreamLineTelemetry` module is intentionally small: a single function `logUnrecognizedLine(providerName, line)` that delegates to the Display service's debug channel. Every provider's `parseStreamLine` calls this function before returning an empty array for an unrecognized line.

For Kimi specifically, three new JSON shapes are recognized:

- `type: "error"` or `type: "agent_error"` → emitted as `ParsedStreamEvent & { type: "result" }`
- `type: "result"` → emitted as `ParsedStreamEvent & { type: "result", result: string }`

## Implementation note

Unrecognized-line logging is centralized in `src/Orchestrator.ts` (calls `logUnrecognizedLine` when a provider's `parseStreamLine` returns `[]`), rather than inside each provider's parser. Behavior matches the PRD intent.

## Acceptance criteria

- [x] `StreamLineTelemetry` module exists with a testable interface and unit tests using a mock Display service
- [x] Unrecognized lines from any provider are logged at debug level through Display in log-to-file mode (via Orchestrator)
- [x] Kimi parser handles `error` and `agent_error` JSON lines, surfacing them as `result` events
- [x] Kimi parser handles `result` JSON lines, populating `resultText` explicitly instead of relying on raw stdout fallback
- [x] Unrecognized lines from any provider are logged at debug level through Display in log-to-file mode
- [x] `AgentProvider.test.ts` covers the new Kimi parser cases: error lines, result lines, malformed JSON, and telemetry invocation

## Blocked by

None — can start immediately
