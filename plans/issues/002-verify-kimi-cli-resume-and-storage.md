# Verify Kimi CLI resume round-trip and session storage layout

**Status**: Done
**Type**: HITL
**Blocked by**: None — can start immediately
**User stories**: 1, 2, 8 (prerequisite research)

## What to build

Run the Kimi CLI empirically to answer two questions needed before implementing session storage:

1. **Resume round-trip**: Run `kimi --print --input-format stream-json --output-format stream-json "hello"`, capture the session ID from stdout, then run `kimi --print -r <id> "continue"`. Does the model continue the conversation from where it left off?

2. **Session storage layout**: After running Kimi, inspect `~/.kimi/` and any other relevant directories. Determine: where session files live, how they're named (by session ID? encoded path?), what format they use (JSONL? SQLite? plain text?), and whether any field in the session data embeds the working directory (requiring cwd rewrite on transfer).

Document findings so the session storage implementation (issue 004) can use them.

## Acceptance criteria

- [x] Resume round-trip verified: `kimi --print -r <id>` successfully continues a prior session
- [x] Session storage directory identified (absolute path)
- [x] File naming convention documented (session ID → filename mapping)
- [x] Session format documented (JSONL, SQLite, or other)
- [x] Whether cwd is embedded in session entries confirmed (yes/no)
- [x] Whether token usage data is present in session files or stream confirmed (yes/no, format if yes)
- [x] Findings written as a comment on this issue or in a short note under `docs/`

## Blocked by

None — can start immediately.

## Findings

### Resume round-trip

Verified with Kimi v1.41.0. `kimi --print -r <sessionId>` successfully continues a prior session. The model correctly references the previous conversation context.

Command sequence:

```sh
echo '{"role":"user","content":"reply with just the word hello"}' | \
  kimi --print --input-format stream-json --output-format stream-json \
  --model "kimi-code/kimi-for-coding"
# → "hello"
# → To resume this session: kimi -r c627e5bd-e3f5-4224-895b-6ca3f4063bba

echo '{"role":"user","content":"remember we said hello before? what was that word?"}' | \
  kimi --print --input-format stream-json --output-format stream-json \
  --model "kimi-code/kimi-for-coding" \
  -r c627e5bd-e3f5-4224-895b-6ca3f4063bba
# → "hello" (model correctly remembered the prior conversation)
```

### Session storage layout

- **Root**: `~/.kimi/sessions/`
- **Structure**: `~/.kimi/sessions/<md5(cwd)>/<turn-uuid>/`
  - `<md5(cwd)>` is the MD5 hex digest of the absolute working directory path
  - `<turn-uuid>` is the session ID emitted in `To resume this session: kimi -r <id>`
- **Files per turn**:
  - `context.jsonl` — conversation entries (JSONL, one JSON object per line)
  - `state.json` — session state metadata (approval mode, plan mode, etc.)
  - `wire.jsonl` — wire protocol events (present in some turns)
  - `tasks/` — subagent task definitions (optional)
  - `subagents/` — subagent data (optional)

### cwd embedding

**No cwd field** found in `context.jsonl` entries. Transfer does not need cwd rewrite — a plain copy between stores is sufficient.

### Token usage

**No token usage data** found in `context.jsonl` or `state.json`. `parseSessionUsage` should remain `undefined` on the Kimi provider.
