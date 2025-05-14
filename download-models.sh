#!/bin/bash
# This script downloads a suitable small GGUF model for testing

# Create models directory if it doesn't exist
mkdir -p models

# Colors for better readability
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Starting model download...${NC}"

# Options for downloading different models
echo "Select a model to download:"
echo "1) TinyLlama-1.1B-Chat-v1.0.Q4_K.gguf (1.1GB)"
echo "2) Phi-2.Q4_K.gguf (1.2GB)" 
echo "3) StableLM-Zephyr-3B.Q4_K.gguf (1.9GB)"
echo "4) SmolLM2-135M-Instruct.Q2_K.gguf (135MB) [Recommended for testing]"

read -p "Enter your choice (1-4, default 4): " choice

case $choice in
    1)
        MODEL_URL="https://huggingface.co/TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF/resolve/main/tinyllama-1.1b-chat-v1.0.Q4_K.gguf"
        MODEL_NAME="tinyllama-1.1b-chat-v1.0.Q4_K.gguf"
        ;;
    2)
        MODEL_URL="https://huggingface.co/TheBloke/Phi-2-GGUF/resolve/main/phi-2.Q4_K.gguf"
        MODEL_NAME="phi-2.Q4_K.gguf"
        ;;
    3)
        MODEL_URL="https://huggingface.co/TheBloke/StableLM-Zephyr-3B-GGUF/resolve/main/stablelm-zephyr-3b.Q4_K.gguf"
        MODEL_NAME="stablelm-zephyr-3b.Q4_K.gguf"
        ;;
    *)
        MODEL_URL="https://huggingface.co/HuggingFaceTB/SmolLM2-135M-Instruct-GGUF/resolve/main/HuggingFaceTB.SmolLM2-135M-Instruct.Q2_K.gguf"
        MODEL_NAME="HuggingFaceTB.SmolLM2-135M-Instruct.Q2_K.gguf"
        ;;
esac

echo -e "${YELLOW}Downloading ${MODEL_NAME}...${NC}"
echo "This may take a while depending on your internet connection."

# Try wget first, then curl if wget is not available
if command -v wget > /dev/null; then
    wget -O "models/${MODEL_NAME}" "${MODEL_URL}"
elif command -v curl > /dev/null; then
    curl -L "${MODEL_URL}" -o "models/${MODEL_NAME}"
else
    echo "Error: Neither wget nor curl is available. Please install one of them and try again."
    exit 1
fi

# Check if download was successful
if [ $? -eq 0 ]; then
    echo -e "${GREEN}Download completed successfully!${NC}"
    echo "Model saved to: models/${MODEL_NAME}"
    
    # Update the model path in the configuration file
    echo "{ \"modelPath\": \"models/${MODEL_NAME}\" }" > models/config.json
    
    echo -e "${YELLOW}Now you need to build llama.cpp for WebAssembly:${NC}"
    echo "1. Follow the instructions in BUILD_INSTRUCTIONS.md"
    echo "2. Copy the built WebAssembly files to the wasm/ directory"
    echo "3. Start the server with ./start-server.sh"
else
    echo "Download failed. Please try again or download manually."
fi
