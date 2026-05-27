# Plan: Kimi Code Provider Feature Parity

> Source PRD: `plans/kimi-provider-parity.md`
> Issues: `plans/issues/001–005`

## Architectural decisions

- **sessionStorage on AgentProvider**: Optional `sessionStorage?: { hostStore, sandboxStore, transfer }` sub-object on the interface. Providers that lack it skip session capture (existing codex/pi behavior).
- **Free functions become internal**: `hostSessionStore` and `sandboxSessionStore` remain exported from `SessionStore.ts` but are no longer called directly by the Orchestrator — `claudeCode` consumes them via its `sessionStorage` field.
- **transfer is provider-owned**: cwd-rewrite in `transferSession` is Claude-specific. Kimi's transfer may be a plain copy if the format doesn't embed cwd.
- **Kimi session layout unknown**: Storage directory, naming convention, and format must be empirically verified before implementing factories (Issue 002).
- **captureSessions default true for Kimi**: Matching `ClaudeCodeOptions`, `KimiCodeOptions` gets `captureSessions?: boolean` defaulting to `true`.
- **Resume flag**: Kimi's resume CLI flag is `-r <sessionId>`. Must compose with all other flags.

---

## Phase 1: ADR 0012 — sessionStorage on AgentProvider interface

**User stories**: 6

### What to build

Add optional `sessionStorage` to the `AgentProvider` interface. Wrap `claudeCode`'s existing session store logic behind its new `sessionStorage` field. Migrate Orchestrator, `run.ts`, and `createWorktree.ts` from calling free `hostSessionStore`/`sandboxSessionStore` functions to reading `provider.sessionStorage`. Move `transferSession` into `claudeCode`'s provider. Providers without `sessionStorage` (codex, pi, kimiCode for now) are unaffected.

### Acceptance criteria

- [ ] `AgentProvider` interface gains optional `sessionStorage?: { hostStore, sandboxStore, transfer }`
- [ ] `claudeCode` factory returns `sessionStorage` wrapping the existing free-function stores
- [ ] `claudeCode`'s `sessionStorage.transfer` handles cwd-rewrite (moved from free `transferSession`)
- [ ] Orchestrator reads `provider.sessionStorage` instead of calling free functions directly
- [ ] `run.ts` and `createWorktree.ts` read `provider.sessionStorage` instead of free functions
- [ ] `codex` and `pi` providers unchanged, still `captureSessions: false`
- [ ] All existing tests pass; new tests cover `claudeCode` sessionStorage field presence
- [ ] Free `hostSessionStore`/`sandboxSessionStore` remain exported

---

## Phase 2: KimiCodeOptions + captureSessions + resumeSession wiring

**User stories**: 1, 2, 4

### What to build

Add `captureSessions?: boolean` to `KimiCodeOptions` (default `true`). Wire `resumeSession` into `buildPrintCommand` — append `-r <sessionId>` when set, composing with all existing flags. The provider now has `captureSessions: true` but no `sessionStorage` yet (that comes in Phase 4), so session capture is enabled but the Orchestrator will skip storage operations for Kimi until Phase 4 lands.

### Acceptance criteria

- [ ] `KimiCodeOptions` gains `captureSessions?: boolean`
- [ ] `kimiCode()` returns `captureSessions: true` by default
- [ ] `kimiCode("model", { captureSessions: false })` returns `captureSessions: false`
- [ ] `buildPrintCommand` includes `-r <sessionId>` when `resumeSession` is set
- [ ] `buildPrintCommand` does not include `-r` when `resumeSession` is not set
- [ ] `-r` flag composes with `--thinking`/`--no-thinking`, `--model`, stream-json flags
- [ ] All existing tests updated and passing

---

## Phase 3: Kimi sessionStorage factories

**User stories**: 1, 2, 8
**Blocked by**: Issue 002 (empirical verification)

### What to build

Implement `hostStore`, `sandboxStore`, and `transfer` on the Kimi Code provider using the layout discovered in Issue 002. Wire `sessionStorage` into the `kimiCode()` return value. The Orchestrator (already migrated in Phase 1) picks it up automatically.

### Acceptance criteria

- [ ] `kimiCode()` returns `sessionStorage` with `hostStore`, `sandboxStore`, `transfer`
- [ ] `hostStore` reads/writes from Kimi's host-side session directory
- [ ] `sandboxStore` reads/writes via bind-mount handle primitives
- [ ] `transfer` copies between stores, with cwd rewrite if Kimi embeds cwd
- [ ] Tests: round-trip write→read via hostStore
- [ ] Tests: hostStore→transfer→sandboxStore, content preserved

---

## Phase 4: parseSessionUsage for Kimi (optional)

**User stories**: 3
**Blocked by**: Issue 002 (empirical verification)

### What to build

If Kimi exposes token usage data, implement `parseSessionUsage`. If not, skip this phase.

### Acceptance criteria

- [ ] If supported: `parseSessionUsage` defined, extracts all four token fields
- [ ] If unsupported: `parseSessionUsage` remains undefined
