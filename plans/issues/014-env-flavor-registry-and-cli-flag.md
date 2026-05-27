# Add flavor registry, Node default, and `--flavor` CLI flag

## Parent

`plans/issues/007-prd-environment-flavor-presets.md`

## What to build

Introduce a hardcoded `EnvironmentFlavor` registry in `InitService.ts` with a single `node` flavor whose fragment reproduces the existing system-dependencies block. Refactor all agent `dockerfileTemplate`s to include a `{{FLAVOR_PACKAGES}}` substitution marker in place of the current `RUN apt-get update && apt-get install -y ...` block. Add `--flavor` to the `sandcastle init` CLI command and wire it through `ScaffoldOptions`. When `node` is selected (explicitly or by default), the scaffolded Dockerfile must be byte-identical to today's output.

This slice establishes the flavor mechanism without adding any new flavor content. It is the foundation all other flavor slices build on.

The substitution pattern follows the existing `{{BACKLOG_MANAGER_TOOLS}}` precedent: a simple string replacement performed once at init time. The result is a static user-owned Dockerfile, preserving the "no runtime abstraction layer" principle from `.out-of-scope/custom-base-image-abstraction.md`.

## Acceptance criteria

- [x] `FlavorEntry` interface exists with `name`, `label`, and `dockerfileFragment: string`
- [x] `FLAVOR_REGISTRY` exists with at least one entry: `node` (default)
- [x] All agent `dockerfileTemplate`s contain `{{FLAVOR_PACKAGES}}` and render correctly after substitution
- [x] `ScaffoldOptions` gains an optional `flavor` field
- [x] `scaffold()` looks up the flavor and substitutes its fragment into the Dockerfile
- [x] `--flavor node` produces byte-identical Dockerfile output to the pre-flavor implementation (regression)
- [x] `--flavor unknown` errors early with a clear message listing valid flavor names
- [x] `InitService.test.ts` covers registry lookup, substitution, and CLI flag parsing
- [x] `cli.test.ts` covers `--flavor` flag acceptance and rejection

## Blocked by

None — can start immediately.
