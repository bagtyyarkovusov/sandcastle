# Thinking chunk separation

## Parent

`plans/issues/006-prd-kimi-provider-parity.md`

## What to build

Separate thinking chunks from text chunks so that Kimi's `--thinking` output is distinguishable from final answers in both terminal display and run logs.

This slice cuts through the event type layer (`ParsedStreamEvent` gains `thinking`, `AgentStreamEvent` gains `thinking`), the orchestration layer (new `onThinking` callback separate from `onText`), the display layer (`Display.thinking()` for terminal mode and log-to-file mode), and the public callback layer (`onAgentStreamEvent` receives `thinking` events).

End-to-end behavior: when Kimi emits a `ContentPart` with `type: "think"` or a legacy `role: "assistant"` block with `type: "think"`, the chunk is routed through `onThinking` instead of `onText`. In terminal mode, thinking output is rendered dimmed (gray). In log-to-file mode, thinking lines are prefixed with a marker (e.g., `[thinking]`) so post-run analysis can filter them. The `onAgentStreamEvent` callback receives `{ type: "thinking", text, iteration, timestamp }` events.

## Acceptance criteria

- [x] `ParsedStreamEvent` union includes a `thinking` variant
- [x] `AgentStreamEvent` union includes a `thinking` variant
- [x] Orchestrator routes `thinking` events through a dedicated `onThinking` callback, not `onText`
- [x] `Display` service exposes `thinking(text)` with distinct rendering in terminal mode (dimmed gray)
- [x] Log-to-file mode writes thinking chunks with a distinguishable prefix
- [x] `onAgentStreamEvent` callback receives `thinking` events
- [x] `Orchestrator.test.ts` verifies thinking events do not trigger `onText`
- [x] `Display.test.ts` verifies `thinking()` rendering behavior

## Blocked by

None — can start immediately
