# Kimi Code provider: bring to feature parity with Claude Code

## Problem Statement

The Kimi Code agent provider was added as a built-in provider, but it was implemented as a second-class citizen compared to Claude Code. It ships with `captureSessions: false` hardcoded, has no session storage support, ignores resume requests, and lacks token usage parsing. Meanwhile, `docs/agents/adding-an-agent-provider.md` states that resume support is a hard requirement for new agent providers, and ADR 0012 (`docs/adr/0012-agent-provider-owned-session-storage.md`) describes a provider-owned session storage model that Kimi does not participate in.

Users who scaffold a project with `sandcastle init` selecting Kimi Code and the Context7 Enhanced template get a working orchestration loop, but they cannot resume interrupted runs, cannot track token usage per iteration, and the provider is architecturally incomplete compared to the Claude Code reference implementation.

## Solution

Bring the Kimi Code agent provider to full feature parity with Claude Code by:

1. Implementing ADR 0012 — adding a `sessionStorage` sub-object to the `AgentProvider` interface and migrating the Orchestrator to use provider-owned session storage instead of the current Claude-specific free functions.
2. Adding Kimi-specific session storage factories (host store, sandbox store, transfer) that know Kimi's on-disk session layout.
3. Enabling `captureSessions: true` by default on the Kimi provider and exposing the kill-switch on `KimiCodeOptions`.
4. Wiring `resumeSession` through `buildPrintCommand` so resumed runs pick up where they left off.
5. Adding `parseSessionUsage` to extract token counts from Kimi session logs, surfacing them in the display.

The Context7 Enhanced template (`src/templates/context7-enhanced/`) already uses `sandcastle.kimiCode()` for all four agent roles (planner, implementer, reviewer, merger) with appropriate thinking mode configuration. Once the provider itself is upgraded, the template benefits automatically.

## User Stories

1. As a developer using Sandcastle with Kimi Code, I want my runs to capture sessions by default, so that I can resume interrupted work without losing context.
2. As a developer using Sandcastle with Kimi Code, I want to pass `resumeSession` to `sandcastle.run()` and have it actually resume the Kimi session, so that long-running orchestration loops survive sandbox restarts.
3. As a developer using Sandcastle with Kimi Code, I want to see token usage per iteration in the terminal display, so that I can monitor costs and debug unexpectedly expensive iterations.
4. As a developer using Sandcastle with Kimi Code, I want `captureSessions: false` to be an explicit opt-out on `KimiCodeOptions`, so that I can disable session capture when I don't need it (matching the `ClaudeCodeOptions` API shape).
5. As a developer scaffolding a new Sandcastle project with Kimi Code, I want the generated `.sandcastle/main.mts` to use `kimiCode()` with thinking mode configured per agent role (planner: off; implementer/reviewer/merger: on), so that the planner produces clean structured output while other agents benefit from reasoning transparency.
6. As a Sandcastle contributor adding a future agent provider, I want the `AgentProvider` interface to include `sessionStorage` as described in ADR 0012, so that the interface contract matches the documented architecture and new providers follow the same pattern.
7. As a developer using Sandcastle with the Context7 Enhanced template, I want the template to use Kimi Code exclusively (not Claude Code), since the template's `compatibleAgents` already restricts it to `kimi-code`.
8. As a developer running Kimi Code in a Docker sandbox, I want session files to transfer correctly between host and sandbox when using bind-mount sandbox providers, so that resume works regardless of where the original session ran.
9. As a developer using Sandcastle in terminal mode, I want Kimi's thinking content (when `thinking: true`) to stream inline in the display, so that I can follow the agent's reasoning in real time.
10. As a developer using Sandcastle in log-to-file mode, I want Kimi's thinking content included in the run log alongside regular text output, so that post-hoc debugging has full context.

## Implementation Decisions

### Module: AgentProvider interface upgrade (ADR 0012 implementation)

Add an optional `sessionStorage` sub-object to the `AgentProvider` interface, matching the shape described in ADR 0012:

```
sessionStorage?: {
  hostStore(cwd: string): SessionStore;
  sandboxStore(cwd: string, handle: BindMountSandboxHandle): SessionStore;
  transfer(from: SessionStore, to: SessionStore, id: string): Promise<void>;
}
```

The existing free functions `hostSessionStore` and `sandboxSessionStore` in `SessionStore.ts` become implementation details consumed by `claudeCode`'s `sessionStorage` factories. The Orchestrator, `run.ts`, and `createWorktree.ts` switch from calling the free functions to reading `provider.sessionStorage`. Providers without `sessionStorage` (codex, pi) continue to have `captureSessions: false` and skip session capture entirely.

The `transferSession` free function moves into `claudeCode`'s `sessionStorage.transfer` since the cwd-rewrite logic is Claude-specific. A future file-based helper may be extracted when codex lands (as noted in ADR 0012).

### Module: Kimi session storage

Kimi Code stores sessions on disk. The exact layout needs empirical verification before implementation — run Kimi, capture a session ID, and inspect the filesystem to determine the storage directory, file naming convention, and whether the format embeds the working directory (requiring cwd rewrite on transfer, like Claude Code).

The parser already extracts session IDs: `To resume this session: kimi -r <sessionId>`. The resume CLI flag is `kimi -r <sessionId>`. The storage factories will:

- **hostStore**: Read/write session files from Kimi's host-side session directory.
- **sandboxStore**: Read/write via bind-mount handle primitives (`copyFileIn`/`copyFileOut`), analogous to `sandboxSessionStore`.
- **transfer**: Copy session content between stores, applying any format-specific field rewrites if Kimi embeds the cwd.

### Module: KimiCodeOptions expansion

Add `captureSessions?: boolean` to the `KimiCodeOptions` interface, defaulting to `true` (matching `ClaudeCodeOptions`). The factory passes it through to `captureSessions` on the returned `AgentProvider`.

### Module: buildPrintCommand resume wiring

When `resumeSession` is set in `AgentCommandOptions`, append `-r <sessionId>` to the Kimi command. The flag must compose with `--print`, `--input-format stream-json`, `--output-format stream-json`, `--thinking`/`--no-thinking`, and `--model`. Verify empirically that `kimi --print -r <id>` resumes correctly before shipping.

### Module: parseSessionUsage for Kimi

Inspect Kimi's session log format to determine whether token usage is recorded and in what shape. If Kimi emits usage data in its stream or session files, implement `parseSessionUsage` on the Kimi provider. If the CLI does not expose usage data, leave it undefined (as with codex and pi).

### Template: Context7 Enhanced main.mts (already done)

The Context7 Enhanced template already uses `sandcastle.kimiCode()` for all four agent roles with correct thinking mode settings. No further template changes are needed — the provider upgrades benefit the template automatically.

### Session ID extraction (already done)

The parser already extracts session IDs from `To resume this session: kimi -r <sessionId>` lines and from wire protocol events. The `session_id` event type is already wired. No parser changes needed.

## Testing Decisions

Tests should verify external behavior, not implementation details. Follow the existing patterns in `AgentProvider.test.ts`.

### AgentProvider tests (Kimi-specific)

- `kimiCode` factory returns `captureSessions: true` by default
- `kimiCode` with `captureSessions: false` opts out
- `buildPrintCommand` includes `-r <sessionId>` when `resumeSession` is set
- `buildPrintCommand` does not include `-r` when `resumeSession` is not set
- `sessionStorage` is defined on `kimiCode` return value (hostStore, sandboxStore, transfer are callable)
- `parseSessionUsage` extracts token counts from representative Kimi session content (if Kimi exposes usage)
- Session ID extraction from `To resume this session: kimi -r <id>` continues to work
- Session storage round-trip: write a session via hostStore, read it back, content matches
- Session storage transfer: write via hostStore, transfer to sandboxStore, read via sandboxStore, content preserved (with cwd rewrite if applicable)

### AgentProvider tests (interface-level)

- Providers without `sessionStorage` (codex, pi) continue to have `captureSessions: false` and do not break
- `claudeCode`'s `sessionStorage` field is present and its factories are callable (existing behavior, now via interface field)

### Prior art

- `AgentProvider.test.ts` lines 816-1381: existing Kimi provider tests (thinking mode, wire protocol, tool calls)
- `AgentProvider.test.ts` lines 1538-1566: existing `captureSessions` flag tests

## Out of Scope

- **Adding session storage to codex or pi providers.** They continue with `captureSessions: false`. This PRD only brings Kimi to parity.
- **Changing Kimi's thinking mode behavior.** The `--thinking`/`--no-thinking` flag mapping and parser support are already correct.
- **Adding new Kimi-specific templates.** The Context7 Enhanced template is the only Kimi-exclusive template; other templates remain agent-agnostic.
- **Kimi interactive mode (`buildInteractiveArgs`).** Already implemented and not part of this PRD.
- **Changing the Context7 Enhanced template's orchestration logic.** The template's plan→execute→review→merge loop is correct; only the agent factory calls were fixed.

## Further Notes

- The Kimi CLI's resume round-trip must be empirically verified before implementing session storage. Run `kimi --print --input-format stream-json --output-format stream-json "hello"`, capture the session ID from the output, then run `kimi --print -r <id> "continue"` and confirm the model continues the conversation.
- Kimi's session storage directory layout is currently unknown and must be discovered empirically. Check `~/.kimi/` for session files or similar locations.
- If Kimi's session format does not embed the working directory, the `transfer` implementation can be a plain copy (no cwd rewrite needed), making it simpler than Claude Code's transfer.
- The ADR 0012 implementation (adding `sessionStorage` to the interface) affects all providers and the Orchestrator, so it should be a separate, atomic commit before the Kimi-specific changes.
- Token usage display requires understanding Kimi's session log format. If Kimi streams usage in its wire protocol, the parser may need a minor update to capture it.
