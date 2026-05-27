# Add Python flavor preset

## Parent

`plans/issues/007-prd-environment-flavor-presets.md`

## What to build

Add `python` to the `FLAVOR_REGISTRY` in `InitService.ts`. Its `dockerfileFragment` installs `python3-pip`, `python3-venv`, and sets `PYTHONPATH` so that Python projects work out of the box inside the sandbox. The fragment is injected via the existing `{{FLAVOR_PACKAGES}}` substitution mechanism established in the Node flavor slice.

This is a thin vertical slice: one new registry entry, one new test case, and verification that the scaffolded Dockerfile is correct.

## Acceptance criteria

- [x] `python` flavor exists in `FLAVOR_REGISTRY`
- [x] Python flavor's fragment installs `python3-pip` and `python3-venv`
- [x] Python flavor's fragment sets `PYTHONPATH` appropriately
- [x] `sandcastle init --flavor python` scaffolds a Dockerfile containing `pip`, `venv`, and `PYTHONPATH`
- [x] The scaffolded Dockerfile does **not** contain JVM, Go, or Rust tooling
- [x] Tests verify rendered output for Python flavor against fixture expectations
- [x] The resulting Dockerfile remains fully editable by the user (no runtime lock-in)

## Blocked by

- `014-env-flavor-registry-and-cli-flag.md` (needs the registry and substitution mechanism)
