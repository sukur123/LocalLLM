#!/bin/bash
# setup-emscripten.sh - Setup Emscripten for WASM compilation

# Colors for better readability
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Setting up Emscripten environment...${NC}"

# Check if emsdk is already in place
EMSDK_DIR="$(dirname "$0")/emsdk"
if [ ! -d "$EMSDK_DIR" ]; then
    echo -e "${YELLOW}Cloning Emscripten SDK...${NC}"
    git clone https://github.com/emscripten-core/emsdk.git "$EMSDK_DIR"
fi

# Enter the emsdk directory
cd "$EMSDK_DIR"

# Update emsdk
echo -e "${YELLOW}Updating Emscripten SDK...${NC}"
git pull

# Install latest sdk tools
echo -e "${YELLOW}Installing latest Emscripten SDK...${NC}"
./emsdk install latest

# Activate the latest sdk
echo -e "${YELLOW}Activating latest Emscripten SDK...${NC}"
./emsdk activate latest

# Source the environment
echo -e "${YELLOW}Sourcing Emscripten environment...${NC}"
source ./emsdk_env.sh

# Print verification
if command -v emcc &> /dev/null; then
    echo -e "${GREEN}Emscripten installed successfully!${NC}"
    echo "Emscripten version: $(emcc --version)"
else
    echo -e "${RED}Failed to install Emscripten!${NC}"
    exit 1
fi

# Print instructions for manual sourcing
echo -e "${YELLOW}For manual sourcing, run:${NC}"
echo "source $(pwd)/emsdk_env.sh"

# Create a helper script to set environment variables
cat > "$(dirname "$0")/source-emscripten.sh" << EOF
#!/bin/bash
source "$EMSDK_DIR/emsdk_env.sh"
echo "Emscripten environment activated!"
echo "Run your build with: ./build-wasm.sh"
EOF

chmod +x "$(dirname "$0")/source-emscripten.sh"

echo -e "${GREEN}Setup complete!${NC}"
echo "1. First source the environment: source ./source-emscripten.sh"
echo "2. Then build WASM: ./build-wasm.sh"
