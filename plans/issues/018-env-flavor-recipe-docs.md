# Add environment recipe docs for complex stacks

## Parent

`plans/issues/007-prd-environment-flavor-presets.md`

## What to build

Create a `docs/environments/` directory containing markdown recipe files for technology stacks that are too complex for a simple preset. These are documentation, not code — each recipe is a copy-paste Dockerfile snippet with explanatory comments that a user can paste into their scaffolded `.sandcastle/Dockerfile`.

Files to create:

- `docs/environments/README.md` — Explains the flavor system, how to use presets, and how to manually customize a Dockerfile after init
- `docs/environments/flutter.md` — Flutter SDK + Android SDK installation recipe
- `docs/environments/expo-go.md` — Android SDK + Expo CLI installation recipe
- `docs/environments/kotlin-android.md` — Kotlin + Android SDK installation recipe

All mobile recipes must include a disclaimer that Android builds are possible inside a Linux container but iOS builds require a macOS host and are out of scope for Docker-based sandboxes.

## Acceptance criteria

- [x] `docs/environments/README.md` exists and explains: (a) what flavors are, (b) how to use `--flavor`, (c) how to manually edit the Dockerfile
- [x] `docs/environments/flutter.md` contains a copy-pasteable Dockerfile snippet for Flutter SDK + Android SDK
- [x] `docs/environments/expo-go.md` contains a copy-pasteable Dockerfile snippet for Expo CLI + Android SDK
- [x] `docs/environments/kotlin-android.md` contains a copy-pasteable Dockerfile snippet for Kotlin + Android SDK
- [x] All mobile recipes include the iOS/macOS host disclaimer
- [x] All recipes respect the `ARG AGENT_UID/GID`, `USER`, `WORKDIR`, and `ENTRYPOINT` contract from ADR-0014
- [x] No runtime code changes — docs only

## Blocked by

None — can start immediately (docs are independent of implementation).
