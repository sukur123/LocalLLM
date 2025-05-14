#!/bin/bash
# install-dependencies.sh - Install dependencies needed for WebAssembly compilation

# Colors for better readability
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Installing dependencies for llama.cpp WebAssembly compilation...${NC}"

# Check if we have sudo access
if command -v sudo &> /dev/null; then
    # Install required packages
    echo -e "${YELLOW}Installing libcurl development packages...${NC}"
    sudo apt-get update
    sudo apt-get install -y libcurl4-openssl-dev
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}Failed to install libcurl4-openssl-dev.${NC}"
        echo "You may need to install it manually."
        exit 1
    fi
    
    echo -e "${YELLOW}Installing additional build dependencies...${NC}"
    sudo apt-get install -y build-essential cmake
    
    echo -e "${GREEN}Dependencies installed successfully!${NC}"
else
    echo -e "${RED}Sudo command not available.${NC}"
    echo "Please manually install the following packages:"
    echo "- libcurl4-openssl-dev"
    echo "- build-essential"
    echo "- cmake"
    exit 1
fi

echo -e "${YELLOW}Setting up build environment...${NC}"

# Make sure Emscripten is properly set up
if [ ! -d "emsdk" ]; then
    echo -e "${YELLOW}Setting up Emscripten...${NC}"
    ./setup-emscripten.sh
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}Failed to set up Emscripten.${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}Build dependencies installed successfully!${NC}"
echo "Next steps:"
echo "1. Activate Emscripten environment: source ./source-emscripten.sh"
echo "2. Run the build script: ./build-wasm-simple.sh"
