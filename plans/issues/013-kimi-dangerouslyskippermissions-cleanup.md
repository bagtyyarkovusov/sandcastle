# `dangerouslySkipPermissions` cleanup

## Parent

`plans/issues/006-prd-kimi-provider-parity.md`

## What to build

Research whether the Kimi CLI supports a non-interactive / permission-skipping flag, then either wire `dangerouslySkipPermissions` through or remove it from the Kimi type contract.

This slice cuts through the agent provider layer (`KimiCodeOptions` type, `buildPrintCommand`, `buildInteractiveArgs`) and the test layer.

End-to-end behavior: the Kimi provider's type system accurately reflects its runtime capabilities. If Kimi CLI has a `--yes` or similar flag, `dangerouslySkipPermissions: true` passes it through. If not, the option is removed from `KimiCodeOptions` so users are not misled by a type-system guarantee with no runtime effect.

## Implementation note

Decision: wire the flag. Kimi CLI supports `--yolo`; `buildPrintCommand` and `buildInteractiveArgs` pass it when `dangerouslySkipPermissions` is true.

## Acceptance criteria

- [x] Kimi CLI documentation or binary is checked for a non-interactive / permission-skipping flag
- [x] Decision recorded in this issue: wire the flag, or remove the field
- [x] If wiring: `buildPrintCommand` and `buildInteractiveArgs` pass the flag when `dangerouslySkipPermissions` is true
- [x] If removing: `KimiCodeOptions` no longer includes `dangerouslySkipPermissions`; `buildPrintCommand` and `buildInteractiveArgs` signatures updated
- [x] `AgentProvider.test.ts` updated to match the chosen behavior

## Blocked by

None — can start immediately
