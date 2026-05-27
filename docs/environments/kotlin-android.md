# Kotlin + Android SDK

Copy-paste the block below **in place of** the `{{FLAVOR_PACKAGES}}` placeholder inside your scaffolded `.sandcastle/Dockerfile`.

> **Mobile disclaimer:** Android builds are possible inside a Linux container. iOS builds require a macOS host and are out of scope for Docker-based sandboxes.

```dockerfile
# ---------------------------------------------------------------------------
# Kotlin + Android SDK
# Paste this block in place of {{FLAVOR_PACKAGES}}
# ---------------------------------------------------------------------------

# 1. System dependencies
#    default-jdk, gradle and maven are included so Kotlin/Gradle projects
#    work out of the box.
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
  default-jdk \
  gradle \
  maven \
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

# 3. Install the standalone Kotlin compiler (optional but useful for CLI scripts)
ENV KOTLIN_HOME=/opt/kotlin
ENV PATH=$PATH:$KOTLIN_HOME/bin

RUN KOTLIN_VERSION="2.0.21" && \
  curl -fsSL -o kotlin-compiler.zip \
    "https://github.com/JetBrains/kotlin/releases/download/v${KOTLIN_VERSION}/kotlin-compiler-${KOTLIN_VERSION}.zip" && \
  unzip -q kotlin-compiler.zip -d /opt && \
  mv /opt/kotlinc $KOTLIN_HOME && \
  rm kotlin-compiler.zip

# ---------------------------------------------------------------------------
# The remainder of the Dockerfile (ARG AGENT_UID/GID, USER, WORKDIR,
# ENTRYPOINT) must stay untouched so Sandcastle can align permissions and
# enter the container correctly.
# ---------------------------------------------------------------------------
```

## What this does

1. **System deps** — Same base set as the `jvm` preset (`default-jdk`, `gradle`, `maven`) so standard Kotlin/JVM and Kotlin/Android projects compile without extra packages.
2. **Android SDK** — Downloads Google's command-line tools, accepts licenses automatically, and installs the Android 34 platform + build tools.
3. **Kotlin compiler** — Downloads the official JetBrains compiler. Most Android projects rely on Gradle's embedded Kotlin, but the standalone compiler is handy for small scripts or CI checks.

## After building the image

Inside the sandbox you can run:

```bash
kotlin -version       # Verify standalone compiler
gradle --version      # Verify Gradle
./gradlew assembleDebug   # Build an Android APK
```
