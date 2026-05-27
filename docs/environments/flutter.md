# Flutter + Android SDK

Copy-paste the block below **in place of** the `{{FLAVOR_PACKAGES}}` placeholder inside your scaffolded `.sandcastle/Dockerfile`.

> **Mobile disclaimer:** Android builds are possible inside a Linux container. iOS builds require a macOS host and are out of scope for Docker-based sandboxes.

```dockerfile
# ---------------------------------------------------------------------------
# Flutter + Android SDK
# Paste this block in place of {{FLAVOR_PACKAGES}}
# ---------------------------------------------------------------------------

# 1. System dependencies required by Flutter and the Android toolchain
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
  xz-utils \
  libglu1-mesa \
  clang \
  cmake \
  ninja-build \
  pkg-config \
  libgtk-3-dev \
  liblzma-dev \
  libstdc++6 \
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

# 3. Install Flutter stable
ENV FLUTTER_HOME=/opt/flutter
ENV PATH=$PATH:$FLUTTER_HOME/bin

RUN git clone --depth 1 --branch stable https://github.com/flutter/flutter.git $FLUTTER_HOME && \
  flutter doctor --android-licenses || true && \
  flutter config --no-analytics && \
  flutter precache --android

# ---------------------------------------------------------------------------
# The remainder of the Dockerfile (ARG AGENT_UID/GID, USER, WORKDIR,
# ENTRYPOINT) must stay untouched so Sandcastle can align permissions and
# enter the container correctly.
# ---------------------------------------------------------------------------
```

## What this does

1. **System deps** — Installs the Debian packages Flutter needs for compilation, tooling, and desktop support.
2. **Android SDK** — Downloads Google's command-line tools, accepts licenses automatically, and pulls the Android 34 platform + build tools.
3. **Flutter** — Clones the stable channel into `/opt/flutter`, disables analytics, and pre-caches Android artifacts so `flutter build` starts faster.

## After building the image

Inside the sandbox you can run:

```bash
flutter doctor        # Verify the toolchain
flutter build apk     # Android build
```
