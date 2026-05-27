---
"@ai-hero/sandcastle": patch
---

Environment flavor presets, macOS GID-20 Docker fix, and Kimi Playwright e2e support

- Add `--flavor` CLI flag and flavor registry (node, python, jvm, go, rust)
- Fix macOS GID 20 Docker build failure with `groupdel -f` conflict resolution across all agent Dockerfile templates
- Add Playwright system deps and Chromium install to Kimi Dockerfile template for in-sandbox e2e tests
- Add environment flavor and Playwright docs under `docs/environments/`
