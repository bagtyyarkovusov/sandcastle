# Environment Flavors & Recipes

## What are flavor presets?

Sandcastle's `init` command can scaffold a project-specific `.sandcastle/Dockerfile`.  
Flavor presets are **hard-coded Dockerfile fragments** stored inside `InitService.ts`. When you run:

```bash
sandcastle init --flavor python
```

the `{{FLAVOR_PACKAGES}}` placeholder in the scaffolded Dockerfile is replaced with a pre-baked block that installs Python, pip, venv, and common system dependencies.

Presets exist so that the 80 % case (Node, Python, JVM, Go, Rust) requires zero manual Dockerfile editing.

## Available presets

| Preset             | What gets installed                                                                                |
| ------------------ | -------------------------------------------------------------------------------------------------- |
| `node` _(default)_ | `git`, `curl`, `jq`, `python3`, `make`, `g++`, `openssl`, `ca-certificates`, `unzip`, `libssl-dev` |
| `python`           | Node deps **plus** `python3-pip`, `python3-venv` and `PYTHONPATH`                                  |
| `jvm`              | Node deps **plus** `default-jdk`, `gradle`, `maven`                                                |
| `go`               | Node deps **plus** `golang-go`                                                                     |
| `rust`             | Node deps **plus** `rustup` + `rustup default stable`                                              |

## Using a preset

```bash
# Default (node)
sandcastle init

# Explicit preset
sandcastle init --flavor python

# Preset + specific agent
sandcastle init --flavor jvm --agent kimi-code
```

## Customising the Dockerfile after init

If your stack is not covered by the presets above, start with the default (`node`) preset and then edit `.sandcastle/Dockerfile` by hand.

1. Open `.sandcastle/Dockerfile`.
2. Locate the block that was injected in place of `{{FLAVOR_PACKAGES}}`.
3. Replace or extend that block with the packages and tooling your project needs.
4. **Preserve the contract** that comes _after_ the flavor block:
   - `ARG AGENT_UID=1000` / `ARG AGENT_GID=1000`
   - GID conflict resolution block (`groupdel -f` for macOS GID 20)
   - `RUN groupmod … && usermod …`
   - `USER ${AGENT_UID}:${AGENT_GID}`
   - `WORKDIR /home/agent`
   - `ENTRYPOINT ["sleep", "infinity"]`

> Breaking the `ARG`, `USER`, `WORKDIR`, or `ENTRYPOINT` contract can cause permission errors or prevent Sandcastle from entering the container correctly. See ADR-0014 for the rationale.

## Recipes for complex stacks

The files in this directory are copy-pasteable Dockerfile snippets for stacks that are too complex for a simple preset (e.g. mobile SDKs, multi-toolchain setups).

Each recipe is designed to be pasted **in place of** the `{{FLAVOR_PACKAGES}}` block inside your scaffolded `.sandcastle/Dockerfile`.

- [`flutter.md`](flutter.md) — Flutter SDK + Android SDK
- [`expo-go.md`](expo-go.md) — Expo CLI + Android SDK
- [`kotlin-android.md`](kotlin-android.md) — Kotlin + Android SDK

> **Mobile disclaimer:** Android builds are possible inside a Linux container. iOS builds require a macOS host and are out of scope for Docker-based sandboxes.

## Playwright e2e in sandbox

The Kimi agent Dockerfile template includes Playwright system libraries and runs `npx playwright install chromium` so agents can execute `npm run test:e2e` inside the container. If you add Playwright to a custom Dockerfile after init, install the same system packages as root, then run `npx playwright install chromium` as the agent user after `USER`.
