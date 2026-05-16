# PRD: Kimi Provider Parity

## Problem Statement

The Kimi agent provider in Sandcastle lags behind the Claude Code agent provider in robustness and observability. When using the Kimi agent in an iteration, errors emitted by the Kimi CLI on stdout are silently dropped, structured output extraction relies on a fragile stdout fallback, token usage is never reported, reasoning chains are indistinguishable from final output in logs, and malformed stream lines disappear without a trace. This makes debugging Kimi failures significantly harder than debugging Claude Code failures, and prevents users from tracking cost or performance across iterations.

## Solution

Bring the Kimi agent provider to parity with the Claude Code agent provider by: (1) adding error-event parsing and result-event emission to the Kimi stream parser, (2) implementing session-usage extraction from Kimi's captured sessions, (3) separating thinking chunks from text chunks in run logs and the agent stream event callback, and (4) adding debug-level telemetry whenever any agent provider drops an unrecognized stream line. The user-visible outcome is that Kimi iterations fail with the same richness of error detail as Claude Code iterations, token usage appears in run results, and reasoning output is optionally visible or hidden in logs.

## User Stories

1. As a Sandcastle user running Kimi as my agent, I want error messages from the Kimi CLI to surface in the run result, so that I can diagnose why an iteration failed without manually inspecting raw stdout.
2. As a Sandcastle user running Kimi as my agent, I want token-usage data (input and output tokens) to appear in the run result, so that I can track cost and performance across iterations.
3. As a Sandcastle user running Kimi as my agent, I want reasoning chains emitted by `--thinking` to be distinguishable from final answers in my run log, so that I can audit the agent's reasoning separately from its output.
4. As a Sandcastle user running Kimi as my agent, I want the `dangerouslySkipPermissions` option to either be wired to a Kimi CLI flag or be removed from the type contract, so that I am not misled by a type-system guarantee that has no runtime effect.
5. As a Sandcastle developer adding a new agent provider, I want a shared utility for logging unrecognized stream lines at debug level, so that every provider benefits from the same observability without duplicating logic.
6. As a Sandcastle user debugging a failing iteration, I want unrecognized or malformed lines from the agent's stdout to be logged at debug level, so that I can see what the parser dropped instead of guessing.
7. As a Sandcastle user resuming a session with Kimi, I want the session-ID extraction to be resilient to minor wording changes in the Kimi CLI output, so that session capture does not break on the next Kimi CLI update.
8. As a Sandcastle user running Kimi in terminal mode, I want thinking chunks to be visually distinct (e.g., dimmed or prefixed) from regular text chunks, so that I can follow the agent's reasoning flow.
9. As a Sandcastle user running Kimi in log-to-file mode, I want thinking chunks to be written to the run log with a distinguishable prefix or in a separate section, so that post-run log analysis can filter reasoning from output.
10. As a Sandcastle developer maintaining the Kimi agent provider, I want the session-storage implementation to reuse the same helpers as Claude Code where possible, so that path-construction and transfer logic does not diverge.
11. As a Sandcastle user capturing sessions with Kimi, I want session transfer to survive a single malformed JSONL line, so that one corrupted entry does not crash the entire session capture.
12. As a Sandcastle user using structured output with Kimi, I want the `resultText` fallback to be populated from explicit result events rather than raw stdout, so that structured-output extraction is more reliable.

## Implementation Decisions

- **Kimi stream parser will handle three new event types**: `error`, `agent_error`, and `result`. Error-type lines will be mapped to `ParsedStreamEvent & { type: "result" }` so the Orchestrator's existing error path can surface them, mirroring the Pi and Codex agent providers. Result-type lines will be mapped to `ParsedStreamEvent & { type: "result", result: string }` so `resultText` is populated explicitly rather than falling back to raw stdout.
- **A shared `StreamLineTelemetry` module will be introduced**. Every agent provider's `parseStreamLine` will delegate unrecognized lines to this module, which logs them at debug level through the Display service. This module is a deep module: a single interface (`logUnrecognizedLine(providerName, line)`) that concentrates observability policy in one place.
- **`parseSessionUsage` will be implemented for Kimi**. The Kimi agent provider will gain a `parseSessionUsage` method that reads the captured `context.jsonl` and extracts input-token and output-token counts. If Kimi's session format does not yet store these fields, the method will return `undefined` and the limitation will be documented.
- **Thinking chunks will be routed through a new `onThinking` callback** in the Orchestrator, separate from `onText`. The Display service will gain a `thinking(text)` method that renders thinking output distinctly in terminal mode (e.g., dimmed gray) and prefixes it with a marker in log-to-file mode. The `AgentStreamEvent` union will gain a `thinking` variant so `onAgentStreamEvent` callbacks can distinguish reasoning from output.
- **`dangerouslySkipPermissions` will be wired or removed**. If the Kimi CLI supports a non-interactive flag (e.g., `--yes`), it will be passed through. If not, the field will be removed from `KimiCodeOptions` and `buildPrintCommand` / `buildInteractiveArgs` signatures to eliminate the type-system lie.
- **Session-ID extraction will accept multiple regex patterns**. Instead of a single fragile regex for `To resume this session: kimi -r <id>`, the parser will try a small ordered list of patterns so minor wording changes do not break session capture silently.
- **Session-storage transfer will be hardened**. The JSONL parsing loop in `transfer` will wrap each `JSON.parse` in a try/catch, skipping malformed lines rather than crashing the entire transfer. This applies to all file-based session stores, not just Kimi.

## Testing Decisions

- **Good tests assert external behavior, not parser internals**. For the stream parser, tests should pass a raw line string and assert the returned `ParsedStreamEvent[]` array. For session usage, tests should pass a JSONL blob and assert the returned usage object (or `undefined`).
- **`parseKimiStreamLine` will be tested exhaustively** in `AgentProvider.test.ts`, following the existing pattern for Claude Code and Kimi tests. New test cases will cover: error JSON lines, result JSON lines, malformed JSON, unrecognized event types, and the new telemetry hook.
- **`StreamLineTelemetry` will be tested in isolation** with a mock Display service, asserting that unrecognized lines are logged with the correct provider name and that recognized lines are not logged.
- **`parseSessionUsage` will be tested with fixture JSONL files** representing real Kimi session output, plus edge cases: empty file, missing token fields, malformed JSONL.
- **Thinking display separation will be tested through `Orchestrator.test.ts`** by asserting that thinking events trigger the `onThinking` callback (or equivalent path) and that text events do not.
- **Prior art**: `AgentProvider.test.ts` already contains ~620 lines of Kimi-specific stream-parser tests. `Display.test.ts` already tests the Display service interface. `Orchestrator.test.ts` tests the iteration loop at the SandboxFactory level.

## Out of Scope

- Adding new Kimi CLI flags or changing Kimi's wire protocol — this PRD assumes the existing protocols and adds parsing for shapes that are already emitted.
- Changing how Claude Code, Pi, Codex, or OpenCode handle thinking or error events — those providers keep their current behavior unless they also benefit from the shared `StreamLineTelemetry` module.
- OpenCode stream parser implementation — that is tracked separately.
- Any changes to the Dockerfile, sandbox provider, or environment setup.
- Retry logic for transient failures.

## Further Notes

- The `StreamLineTelemetry` module is intentionally small and shared so that future agent providers (e.g., Gemini CLI) get the same observability for free.
- If Kimi CLI does not yet expose token counts in its session files, `parseSessionUsage` should be implemented as a no-op (`return undefined`) with a code comment linking to a follow-up issue, rather than left as a missing method.
- The thinking separation work touches the public `AgentStreamEvent` type. If this type is part of the public API surface, the addition of a `thinking` variant is a minor (non-breaking) change since the union is widened.
