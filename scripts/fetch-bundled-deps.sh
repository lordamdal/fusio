#!/bin/bash
# Downloads Node.js + NATS server binaries for bundling inside the Fusio .app
# Run this before `npm run tauri build`

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
BIN_DIR="$REPO_ROOT/apps/desktop/src-tauri/bin"
DOCKER_DIR="$REPO_ROOT/apps/desktop/src-tauri/docker"

ARCH=$(uname -m)
NODE_VERSION="22.14.0"
NATS_VERSION="2.10.24"

mkdir -p "$BIN_DIR" "$DOCKER_DIR"

echo "==> Architecture: $ARCH"

# --- Node.js ---
if [ -f "$BIN_DIR/node" ]; then
    echo "==> Node.js already downloaded, skipping"
else
    echo "==> Downloading Node.js v${NODE_VERSION} for ${ARCH}..."
    if [ "$ARCH" = "arm64" ]; then
        NODE_ARCH="arm64"
    else
        NODE_ARCH="x64"
    fi
    TMPDIR=$(mktemp -d)
    curl -sL "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-darwin-${NODE_ARCH}.tar.gz" | tar xz -C "$TMPDIR"
    cp "$TMPDIR/node-v${NODE_VERSION}-darwin-${NODE_ARCH}/bin/node" "$BIN_DIR/node"
    chmod +x "$BIN_DIR/node"
    rm -rf "$TMPDIR"
    echo "    Node.js binary: $BIN_DIR/node ($(du -h "$BIN_DIR/node" | cut -f1))"
fi

# --- NATS Server ---
if [ -f "$BIN_DIR/nats-server" ]; then
    echo "==> NATS server already downloaded, skipping"
else
    echo "==> Downloading NATS server v${NATS_VERSION} for ${ARCH}..."
    if [ "$ARCH" = "arm64" ]; then
        NATS_ARCH="arm64"
    else
        NATS_ARCH="amd64"
    fi
    TMPDIR=$(mktemp -d)
    curl -sL "https://github.com/nats-io/nats-server/releases/download/v${NATS_VERSION}/nats-server-v${NATS_VERSION}-darwin-${NATS_ARCH}.zip" -o "$TMPDIR/nats.zip"
    cd "$TMPDIR" && unzip -q nats.zip
    cp "$TMPDIR/nats-server-v${NATS_VERSION}-darwin-${NATS_ARCH}/nats-server" "$BIN_DIR/nats-server"
    chmod +x "$BIN_DIR/nats-server"
    rm -rf "$TMPDIR"
    echo "    NATS binary: $BIN_DIR/nats-server ($(du -h "$BIN_DIR/nats-server" | cut -f1))"
fi

# --- Dockerfile ---
echo "==> Copying Dockerfile.browser..."
cp "$REPO_ROOT/services/worker-node/docker/Dockerfile.browser" "$DOCKER_DIR/Dockerfile.browser"

echo ""
echo "=== Bundled dependencies ready ==="
ls -lh "$BIN_DIR/"
echo ""
echo "Next: cd apps/desktop && npm run tauri build"
