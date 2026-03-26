#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DESKTOP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=== Fusio Desktop Setup ==="

# Generate icons
echo "Generating placeholder icons..."
python3 "$SCRIPT_DIR/generate-icons.py"

# Install dependencies
echo "Installing npm dependencies..."
cd "$DESKTOP_DIR"
npm install

# TypeScript check
echo "Running TypeScript check..."
npx tsc --noEmit

# Vite build (frontend only)
echo "Building frontend..."
npm run build

echo ""
echo "=== Setup complete ==="
echo "Run 'npm run tauri dev' to start the desktop app (requires Rust toolchain)"
echo "Run 'npm run dev' to start only the frontend dev server"
