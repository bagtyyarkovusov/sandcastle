# Expo CLI + Android SDK

Copy-paste the block below **in place of** the `{{FLAVOR_PACKAGES}}` placeholder inside your scaffolded `.sandcastle/Dockerfile`.

> **Mobile disclaimer:** Android builds are possible inside a Linux container. iOS builds require a macOS host and are out of scope for Docker-based sandboxes.

```dockerfile
# ---------------------------------------------------------------------------
# Expo CLI + Android SDK
# Paste this block in place of {{FLAVOR_PACKAGES}}
# ---------------------------------------------------------------------------

# 1. System dependencies (node base image already contains Node & npm)
RUN apt-get update && apt-get install -y \
  git \
  curl \
  jq \
  python3 \
  make \
  g++ \
  openssl \
  ca-certificates \
  unzip \
  libssl-dev \
  && rm -rf /var/lib/apt/lists/*

# 2. Install Android SDK command-line tools
#    Update the URL below when a newer version is released.
ENV ANDROID_HOME=/opt/android-sdk
ENV PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools

RUN mkdir -p $ANDROID_HOME && cd $ANDROID_HOME && \
  curl -fsSL -o cmdline-tools.zip \
    "https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip" && \
  unzip -q cmdline-tools.zip && rm cmdline-tools.zip && \
  mkdir -p cmdline-tools/latest && \
  mv cmdline-tools/bin cmdline-tools/lib cmdline-tools/NOTICE.txt cmdline-tools/latest/ 2>/dev/null || true && \
  yes | sdkmanager --licenses && \
  sdkmanager "platform-tools" "platforms;android-34" "build-tools;34.0.0"

# 3. Install Expo CLI globally so it is available on PATH
RUN npm install -g expo-cli @expo/ngrok@^4.1.0

# 4. Pre-install EAS CLI for cloud builds (optional but recommended)
RUN npm install -g eas-cli

# ---------------------------------------------------------------------------
# The remainder of the Dockerfile (ARG AGENT_UID/GID, USER, WORKDIR,
# ENTRYPOINT) must stay untouched so Sandcastle can align permissions and
# enter the container correctly.
# ---------------------------------------------------------------------------
```

## What this does

1. **System deps** — Standard Debian packages for Sandcastle agents plus `unzip` for the Android SDK archive.
2. **Android SDK** — Downloads Google's command-line tools, accepts licenses automatically, and installs the Android 34 platform + build tools so `expo run:android` can compile native code.
3. **Expo CLI** — Installs the legacy `expo-cli` and ngrok for tunneling, plus the modern `eas-cli` for EAS Build workflows.

## After building the image

Inside the sandbox you can run:

```bash
expo --version          # Verify Expo CLI
eas --version           # Verify EAS CLI
expo run:android        # Build & run on Android (SDK must be present)
```
