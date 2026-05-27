# Add JVM, Go, and Rust flavor presets

## Parent

`plans/issues/007-prd-environment-flavor-presets.md`

## What to build

Add three new flavors to the `FLAVOR_REGISTRY`: `jvm`, `go`, and `rust`. Each flavor's `dockerfileFragment` installs the minimal toolchain needed to build and run code in that ecosystem inside the sandbox.

- **JVM**: `default-jdk`, `gradle`, and `maven`
- **Go**: `golang-go`
- **Rust**: `rustup` with the default stable toolchain

These are pure content additions to the registry. The substitution mechanism (`{{FLAVOR_PACKAGES}}`) and CLI wiring already exist from the Node flavor slice.

## Acceptance criteria

- [x] `jvm` flavor exists and its fragment installs OpenJDK and Gradle (or Maven)
- [x] `go` flavor exists and its fragment installs `golang-go`
- [x] `rust` flavor exists and its fragment installs `rustup` + default toolchain
- [x] Each flavor's scaffolded Dockerfile contains the expected packages
- [x] No flavor's Dockerfile contains packages from another flavor (no cross-contamination)
- [x] Tests verify rendered output for each flavor independently
- [x] Invalid or unknown flavors continue to error with a clear message

## Blocked by

- `014-env-flavor-registry-and-cli-flag.md` (needs the registry and substitution mechanism)
