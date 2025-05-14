#!/bin/sh
# Source the Emscripten environment

SCRIPT_DIR="$(cd "$(dirname "${0}")" && pwd)"
EMSDK_DIR="${SCRIPT_DIR}/emsdk"

if [ ! -d "${EMSDK_DIR}" ]; then
    echo "Emscripten SDK not found at ${EMSDK_DIR}"
    echo "Please run ./setup-emscripten.sh first"
    exit 1
fi

echo "Sourcing Emscripten environment from ${EMSDK_DIR}..."
source "${EMSDK_DIR}/emsdk_env.sh"

echo "Checking Emscripten version..."
if command -v emcc > /dev/null; then
    emcc --version
    echo "Emscripten environment activated successfully!"
    echo "You can now run build scripts like ./build-wasm-simple.sh"
else
    echo "Failed to activate Emscripten environment!"
    echo "Try running the setup again with: ./setup-emscripten.sh"
    exit 1
fi
