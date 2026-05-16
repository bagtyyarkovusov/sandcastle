# PRD: Environment Flavor Presets for Init

## Problem Statement

Sandcastle scaffolds the same `node:22-bookworm` Dockerfile for every project, regardless of the actual technology stack. Users working on Python, JVM, Go, Rust, or mobile projects must manually edit `.sandcastle/Dockerfile` after `init` to install their toolchains. There is no guidance, no preset, and no template-level hint for what a Flutter, Expo Go, or Kotlin sandbox should look like. This creates friction for non-Node users and increases the chance of misconfigured sandboxes.

## Solution

Introduce **environment flavor presets** that `sandcastle init` can use to scaffold a better default Dockerfile for the user's stack. Flavors are hardcoded Dockerfile variants (not an abstraction layer) — the user still owns the resulting Dockerfile fully. Additionally, allow templates to declare an `environment` field that influences the default scaffold, and publish a `docs/environments/` recipe collection for stacks that are too complex for a simple preset.

## User Stories

1. As a developer initializing Sandcastle for a Python project, I want `sandcastle init` to scaffold a Dockerfile that includes `pip`, `venv`, and `PYTHONPATH`, so that I don't have to manually add Python tooling.
2. As a developer initializing Sandcastle for a Kotlin project, I want `sandcastle init` to scaffold a Dockerfile that includes OpenJDK and Gradle, so that my agent can build and test JVM code inside the sandbox.
3. As a developer initializing Sandcastle for a Flutter project, I want a documented recipe for installing the Flutter SDK and Android SDK inside the sandbox Dockerfile, so that I have a working starting point instead of figuring it out from scratch.
4. As a developer initializing Sandcastle for an Expo Go project, I want a documented recipe for installing the Android SDK and Expo CLI inside the sandbox Dockerfile, so that my agent can run and test mobile applications.
5. As a Sandcastle template author, I want my template's `template.json` to declare `environment: "python"`, so that when a user runs `sandcastle init` with my template, the scaffolded Dockerfile is pre-configured for Python.
6. As a developer who chose the wrong flavor during init, I want the resulting Dockerfile to be fully editable, so that I can change the base image or add packages without being locked into a preset.
7. As a Sandcastle maintainer, I want the flavor system to be a collection of hardcoded Dockerfile fragments, not an abstraction layer, so that the "user owns the Dockerfile" principle from `.out-of-scope/custom-base-image-abstraction.md` is preserved.
8. As a developer using Sandcastle with Go, I want `sandcastle init` to offer a Go flavor that installs `golang-go`, so that I can compile Go code inside the sandbox.
9. As a developer using Sandcastle with Rust, I want `sandcastle init` to offer a Rust flavor that installs `rustup`, so that I can build Rust projects inside the sandbox.
10. As a developer using Sandcastle with a Node project, I want the Node flavor to remain the default, so that existing behavior is unchanged.
11. As a developer using an exotic stack not covered by presets, I want the docs to explain how to customize the Dockerfile manually, so that I am not blocked.
12. As a Sandcastle user running `sandcastle init` non-interactively (e.g., in CI), I want to pass `--flavor <name>` so that the scaffold is deterministic.

## Implementation Decisions

- **An `EnvironmentFlavor` registry will be introduced**. Each flavor is a name (e.g., `"node"`, `"python"`, `"jvm"`, `"go"`, `"rust"`) mapped to a hardcoded Dockerfile fragment string. The fragment replaces or extends the default `RUN apt-get install ...` block in the scaffolded Dockerfile. This is not an abstraction layer — it is a lookup table of strings.
- **The `init` flow will gain an optional flavor prompt**. After selecting the agent and backlog manager, `sandcastle init` will ask: "What stack is this project?" with a list of known flavors plus "Other / I'll customize later." The default is `"node"`.
- **Templates can declare `environment` in `template.json`**. If a template specifies `environment: "python"`, the init system uses that flavor as the default for the prompt (pre-selected but still confirmable by the user). If the template specifies no environment, the prompt defaults to `"node"`.
- **A `--flavor` CLI flag will be added to `sandcastle init`**. Non-interactive usage can bypass the prompt: `sandcastle init --flavor python`. Invalid flavor names error early.
- **Dockerfile fragment composition is simple string replacement**. The existing Dockerfile template in `InitService.ts` will be refactored into: (1) a common header (base image, user setup, UID/GID), (2) a flavor-specific middle section (system packages + stack tooling), and (3) a common footer (agent install, user switch, entrypoint). The flavor only controls the middle section.
- **`docs/environments/` will contain markdown recipe files** for stacks too complex for a simple preset: `expo-go.md`, `flutter.md`, `kotlin-android.md`. Each recipe is a copy-paste Dockerfile snippet with explanatory comments. These are documentation, not code.
- **The existing `.out-of-scope/custom-base-image-abstraction.md` decision is respected**. No runtime abstraction layer, no programmatic Dockerfile composition API, no base-image registry. The flavor system exists only at init-time and produces a static Dockerfile that the user owns.

## Testing Decisions

- **Good tests assert rendered Dockerfile output, not internal fragment strings**. For each flavor, the test runs the init scaffold logic (or a pure rendering function) and asserts that the resulting Dockerfile contains expected packages and does not contain packages from other flavors.
- **`InitService.test.ts` will be extended** with flavor-specific test cases, following the existing pattern that tests agent/backlog-manager substitution.
- **Template environment defaulting will be tested** by passing templates with `environment` fields and asserting the correct flavor is pre-selected.
- **CLI flag parsing will be tested** in `cli.test.ts` by asserting that `--flavor python` is accepted and `--flavor unknown` errors.
- **Prior art**: `InitService.test.ts` already tests Dockerfile scaffolding for all five agent providers. `cli.test.ts` tests command structure and argument parsing.

## Out of Scope

- Runtime Dockerfile customization (e.g., `sandcastle run --flavor`) — flavors are init-time only.
- A public API for third-party flavor plugins — flavors are hardcoded in Sandcastle source.
- Docker image caching or pre-built base images — the user still runs `sandcastle docker build-image` after init.
- Changing how the `sandbox provider` or `bind-mount sandbox provider` works.
- Mobile emulator/simulator setup inside the container — recipes will document limitations (e.g., iOS requires macOS host).

## Further Notes

- The flavor list should start small and grow based on user demand. The initial set is recommended as: `node` (default), `python`, `jvm`, `go`, `rust`.
- Mobile recipes (Expo, Flutter) should include a disclaimer that Android builds are possible in a Linux container but iOS builds require a macOS host and are out of scope for Docker-based sandboxes.
- The `--flavor` flag should also support `--flavor none` or `--flavor minimal` for users who want the common header/footer with an empty middle section.
