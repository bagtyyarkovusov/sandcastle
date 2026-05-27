# Add interactive flavor prompt and template `environment` metadata

## Parent

`plans/issues/007-prd-environment-flavor-presets.md`

## What to build

Add `environment?: string` to `TemplateMetadata` in `InitService.ts` so templates can declare a recommended flavor (e.g., a Python-specific template could declare `"environment": "python"`). Update `template.json` files where a default flavor makes sense.

In `cli.ts`, after template selection, add a clack select prompt: "What stack is this project?" listing all known flavors from `FLAVOR_REGISTRY` plus an "Other / I'll customize later" option. The default selection is pre-filled from the chosen template's `environment` field, falling back to `"node"`.

If the user selects "Other / I'll customize later", scaffold the Dockerfile with the `node` fragment (the common base) but include a comment indicating that the user should customize the middle section. The resulting Dockerfile is still fully user-owned and editable.

## Acceptance criteria

- [x] `TemplateMetadata` gains an optional `environment: string` field
- [x] At least one `template.json` is updated to demonstrate the feature
- [x] Interactive `init` shows a flavor prompt after template selection
- [x] Prompt default is pre-selected from template's `environment` (or `"node"` if absent)
- [x] "Other / I'll customize later" option exists and scaffolds a minimal base
- [x] Non-interactive `init --flavor <name>` bypasses the prompt (already works from Slice 1)
- [x] Tests verify prompt defaulting behavior from template metadata
- [x] Tests verify that "Other" selection still produces a valid Dockerfile

## Blocked by

- `014-env-flavor-registry-and-cli-flag.md` (needs the registry to exist)
- `015-env-flavor-python.md` and `016-env-flavor-jvm-go-rust.md` (soft dependency — the prompt is more useful when multiple flavors exist, but can be built against just `node`)
