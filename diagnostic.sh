#!/bin/bash
# diagnostic.sh - Check the build environment and diagnose issues

# Colors for better readability
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========== WebAssembly Build Environment Diagnostic ===========${NC}"
echo

# Check if Emscripten is installed
echo -e "${YELLOW}Checking Emscripten installation...${NC}"
if command -v emcc &> /dev/null; then
    echo -e "${GREEN}✓ Emscripten found${NC}"
    echo "   Version: $(emcc --version | head -n 1)"
else
    echo -e "${RED}✗ Emscripten not found${NC}"
    echo "   Run ./setup-emscripten.sh to install Emscripten"
fi
echo

# Check for libcurl
echo -e "${YELLOW}Checking libcurl development files...${NC}"
if pkg-config --exists libcurl 2>/dev/null; then
    echo -e "${GREEN}✓ libcurl development files found${NC}"
    echo "   Version: $(pkg-config --modversion libcurl)"
else
    echo -e "${RED}✗ libcurl development files not found${NC}"
    echo "   Run ./install-dependencies.sh to install dependencies"
fi
echo

# Check for CMake
echo -e "${YELLOW}Checking CMake installation...${NC}"
if command -v cmake &> /dev/null; then
    echo -e "${GREEN}✓ CMake found${NC}"
    echo "   Version: $(cmake --version | head -n 1)"
else
    echo -e "${RED}✗ CMake not found${NC}"
    echo "   Run ./install-dependencies.sh to install dependencies"
fi
echo

# Check build directory
echo -e "${YELLOW}Checking build artifacts...${NC}"
if [ -d "build-llama-wasm" ]; then
    echo -e "${GREEN}✓ Build directory exists${NC}"
    echo "   Location: $(pwd)/build-llama-wasm"
    
    if [ -f "build-llama-wasm/libllama.a" ]; then
        echo -e "${GREEN}✓ libllama.a found${NC}"
    else
        echo -e "${RED}✗ libllama.a not found${NC}"
        echo "   Build might have failed"
    fi
else
    echo -e "${YELLOW}! Build directory not found${NC}"
    echo "   This is normal if you haven't built yet"
fi
echo

# Check WASM files
echo -e "${YELLOW}Checking WebAssembly files...${NC}"
if [ -f "wasm/llama-wasm.js" ] && [ -f "wasm/llama-wasm.wasm" ]; then
    echo -e "${GREEN}✓ WebAssembly files found${NC}"
    echo "   JS Size: $(du -h wasm/llama-wasm.js | cut -f1)"
    echo "   WASM Size: $(du -h wasm/llama-wasm.wasm | cut -f1)"
    
    # Check if it's real or just a demo fallback
    if grep -q "Demo WASM module" "wasm/llama-wasm.js"; then
        echo -e "${YELLOW}! Demo mode fallback detected${NC}"
        echo "   These are placeholder files for demo mode"
    else
        echo -e "${GREEN}✓ Real WebAssembly modules detected${NC}"
    fi
else
    echo -e "${YELLOW}! WebAssembly files not found${NC}"
    echo "   This is normal if you haven't built yet"
fi
echo

# Check models
echo -e "${YELLOW}Checking model files...${NC}"
MODEL_COUNT=$(find models -name "*.gguf" | wc -l)
if [ $MODEL_COUNT -gt 0 ]; then
    echo -e "${GREEN}✓ Found $MODEL_COUNT GGUF model file(s)${NC}"
    find models -name "*.gguf" -exec ls -lh {} \; | awk '{print "   " $9 " (" $5 ")"}'
else
    echo -e "${RED}✗ No GGUF model files found${NC}"
    echo "   Run ./download-models.sh to download a model"
fi
echo

# Final report
echo -e "${BLUE}========== Recommendations ===========${NC}"

# Build recommendations
if ! command -v emcc &> /dev/null; then
    echo -e "${YELLOW}1. Install Emscripten:${NC}"
    echo "   ./setup-emscripten.sh"
    echo "   source ./source-emscripten.sh"
elif ! pkg-config --exists libcurl 2>/dev/null; then
    echo -e "${YELLOW}1. Install dependencies:${NC}"
    echo "   ./install-dependencies.sh"
elif [ ! -f "wasm/llama-wasm.wasm" ] || grep -q "Demo WASM module" "wasm/llama-wasm.js" 2>/dev/null; then
    echo -e "${YELLOW}1. Build WebAssembly files:${NC}"
    echo "   source ./source-emscripten.sh"
    echo "   ./build-wasm-simple.sh"
elif [ $MODEL_COUNT -eq 0 ]; then
    echo -e "${YELLOW}1. Download a model:${NC}"
    echo "   ./download-models.sh"
else
    echo -e "${GREEN}✓ Your environment appears ready to run the application${NC}"
    echo "   Start the server: ./start-server.sh"
fi

echo
echo -e "${BLUE}For more detailed help, visit:${NC}"
echo "https://github.com/ggerganov/llama.cpp/blob/master/README.md"
echo
