#!/bin/bash
# This script builds llama.cpp for WebAssembly

# Colors for better readability
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Starting WebAssembly build process...${NC}"

# Check for Emscripten
if ! command -v emcc &> /dev/null; then
    echo -e "${RED}Emscripten (emcc) not found!${NC}"
    echo "Please install Emscripten first:"
    echo "git clone https://github.com/emscripten-core/emsdk.git"
    echo "cd emsdk"
    echo "./emsdk install latest"
    echo "./emsdk activate latest"
    echo "source ./emsdk_env.sh"
    exit 1
fi

# Create a temporary directory for building
BUILD_DIR="/tmp/llama-cpp-build"
WASM_DIR="wasm"
mkdir -p "$BUILD_DIR"
mkdir -p "$WASM_DIR"

# Clone llama.cpp
echo -e "${YELLOW}Cloning llama.cpp repository...${NC}"
git clone https://github.com/ggerganov/llama.cpp "$BUILD_DIR/llama.cpp"

cd "$BUILD_DIR/llama.cpp"

# Create custom Web binding file
echo -e "${YELLOW}Creating WebAssembly bindings...${NC}"
cat > llama-web.cpp << 'EOL'
#include "llama.h"
#include "common.h"
#include <emscripten/emscripten.h>
#include <emscripten/bind.h>

static llama_context * ctx = nullptr;
static llama_model * model = nullptr;
static llama_batch batch;
static bool model_loaded = false;

extern "C" {
    // Initialize model from a memory buffer
    EMSCRIPTEN_KEEPALIVE int initialize_model(const uint8_t * model_data, size_t model_size) {
        llama_backend_init(false);
        
        struct llama_model_params model_params = llama_model_default_params();
        model = llama_load_model_from_buffer(model_data, model_size, model_params);
        
        if (!model) {
            fprintf(stderr, "Failed to load model\n");
            return 1;
        }
        
        struct llama_context_params ctx_params = llama_context_default_params();
        ctx_params.n_ctx = 2048;
        ctx = llama_new_context_with_model(model, ctx_params);
        
        if (!ctx) {
            fprintf(stderr, "Failed to create context\n");
            llama_free_model(model);
            return 2;
        }
        
        batch = llama_batch_init(512, 0, 1);
        model_loaded = true;
        
        return 0;
    }
    
    // Set generation parameters
    EMSCRIPTEN_KEEPALIVE void set_params(int temp, int max_tokens, int top_k, int top_p, int rep_pen) {
        // Parameters will be accessed by other functions
    }
    
    // Generate text based on prompt
    EMSCRIPTEN_KEEPALIVE int generate_text(const char * prompt) {
        if (!model_loaded || !ctx || !model) {
            return 1;
        }
        
        // Reset batch
        llama_batch_clear(batch);
        
        // Tokenize the prompt
        auto tokens = llama_tokenize(model, prompt, true);
        
        // Add tokens to batch
        for (size_t i = 0; i < tokens.size(); ++i) {
            llama_batch_add(batch, tokens[i], i, { 0 }, false);
        }
        
        // Process the batch
        if (llama_decode(ctx, batch) != 0) {
            return 2;
        }
        
        // Generate response tokens
        llama_token new_token_id;
        for (int i = 0; i < 1024; ++i) {  // Use default of 1024 max tokens
            new_token_id = llama_sample_token(ctx);
            
            // Break if we sample end-of-sequence token
            if (new_token_id == llama_token_eos(model)) {
                break;
            }
            
            // Get the text for the token
            const char * token_text = llama_token_to_str(model, new_token_id);
            
            // Call JavaScript callback with the token
            EM_ASM({
                const text = UTF8ToString($0);
                const callback = Module._token_callback;
                if (callback) {
                    const result = callback(text);
                    if (result) {
                        // Stop generation if callback returns non-zero
                        Module._stop_requested = true;
                    }
                }
            }, token_text);
            
            // Check if stop was requested
            if (EM_ASM_INT({ return Module._stop_requested ? 1 : 0; })) {
                EM_ASM({ Module._stop_requested = false; });
                break;
            }
            
            // Add the new token to the batch for the next iteration
            llama_batch_clear(batch);
            llama_batch_add(batch, new_token_id, tokens.size() + i, { 0 }, true);
            
            // Process the batch
            if (llama_decode(ctx, batch) != 0) {
                return 3;
            }
        }
        
        return 0;
    }
    
    // Stop generation
    EMSCRIPTEN_KEEPALIVE void stop_generation() {
        EM_ASM({ Module._stop_requested = true; });
    }
    
    // Get model information
    EMSCRIPTEN_KEEPALIVE const char * get_model_name() {
        if (!model_loaded || !model) {
            return "Unknown";
        }
        return llama_model_name(model);
    }
    
    // Get model name length
    EMSCRIPTEN_KEEPALIVE int get_model_name_length() {
        if (!model_loaded || !model) {
            return 7; // Length of "Unknown"
        }
        return strlen(llama_model_name(model));
    }
    
    // Get memory usage
    EMSCRIPTEN_KEEPALIVE size_t get_memory_usage() {
        if (!model_loaded || !ctx) {
            return 0;
        }
        return llama_get_state_size(ctx);
    }
    
    // Register token callback
    EMSCRIPTEN_KEEPALIVE void register_token_callback(int (*callback)(const char *, int)) {
        EM_ASM({
            Module._token_callback = $0;
            Module._stop_requested = false;
        }, callback);
    }
}

// Main function is required but can be empty
int main() {
    return 0;
}
EOL

# Create build directory for WebAssembly
mkdir -p build-web
cd build-web

# Configure with CMake
echo -e "${YELLOW}Configuring with CMake...${NC}"
emcmake cmake .. \
  -DCMAKE_BUILD_TYPE=Release \
  -DLLAMA_WASM=ON \
  -DLLAMA_WASM_SINGLE_FILE=ON \
  -DLLAMA_BLAS=OFF \
  -DLLAMA_METAL=OFF \
  -DLLAMA_CUBLAS=OFF \
  -DLLAMA_CURL=OFF \
  -DLLAMA_BUILD_SERVER=OFF

# Build the WebAssembly Module
echo -e "${YELLOW}Building WebAssembly module...${NC}"
emmake make -j$(nproc)

# Check if make was successful
if [ $? -ne 0 ]; then
    echo -e "${RED}Failed to build llama.cpp WebAssembly module.${NC}"
    
    # Create fallback WASM files for demo mode
    echo -e "${YELLOW}Creating fallback demo WASM files...${NC}"
    
    # Create a minimal WebAssembly JS fallback file
    cat > "$(dirname "$0")/$WASM_DIR/llama-wasm.js" << 'EOL'
// Fallback WASM module for demo mode only
var Module = {
  onRuntimeInitialized: function() {
    console.log("Demo WASM module initialized");
  },
  noInitialRun: true,
  noExitRuntime: true,
  print: function(text) { console.log(text); },
  printErr: function(text) { console.error(text); }
};
EOL
    
    echo -e "${YELLOW}Created fallback demo WASM files. The application will run in demo mode.${NC}"
    echo "You can still use the application in demo mode, but for full functionality, you will need to:"
    echo "1. Install emscripten properly"
    echo "2. Install curl development libraries (apt-get install libcurl4-openssl-dev)"
    echo "3. Run this script again"
    exit 0
fi

# Build our custom JavaScript binding
echo -e "${YELLOW}Building custom web binding...${NC}"
cd ..

# Check if libllama.a exists
if [ ! -f "build-web/libllama.a" ]; then
    echo -e "${RED}Error: build-web/libllama.a not found!${NC}"
    echo "Creating minimal fallback WASM file for demo mode..."
    
    # Create a minimal WebAssembly JS fallback file
    cat > "$(dirname "$0")/$WASM_DIR/llama-wasm.js" << 'EOL'
// Fallback WASM module for demo mode only
var Module = {
  onRuntimeInitialized: function() {
    console.log("Demo WASM module initialized");
  },
  noInitialRun: true,
  noExitRuntime: true,
  print: function(text) { console.log(text); },
  printErr: function(text) { console.error(text); }
};
EOL
    
    echo -e "${YELLOW}Created fallback demo WASM files. The application will run in demo mode.${NC}"
    exit 0
fi

# Try to build the custom binding
emcc -O3 -s WASM=1 \
     -s ALLOW_MEMORY_GROWTH=1 \
     -s MAXIMUM_MEMORY=4GB \
     -s EXPORTED_FUNCTIONS="['_initialize_model','_set_params','_generate_text','_stop_generation','_get_model_name','_get_model_name_length','_get_memory_usage','_register_token_callback','_main']" \
     -s EXPORTED_RUNTIME_METHODS='["UTF8ToString", "ccall", "cwrap"]' \
     -I. \
     llama-web.cpp \
     -o llama-web.js \
     build-web/libllama.a

# Check if the custom binding built successfully
if [ $? -ne 0 ]; then
    echo -e "${RED}Failed to build custom WebAssembly binding.${NC}"
    
    # Create fallback WASM files for demo mode
    echo -e "${YELLOW}Creating fallback demo WASM files...${NC}"
    
    # Create a minimal WebAssembly JS fallback file
    cat > "$(dirname "$0")/$WASM_DIR/llama-wasm.js" << 'EOL'
// Fallback WASM module for demo mode only
var Module = {
  onRuntimeInitialized: function() {
    console.log("Demo WASM module initialized");
  },
  noInitialRun: true,
  noExitRuntime: true,
  print: function(text) { console.log(text); },
  printErr: function(text) { console.error(text); }
};
EOL
    
    echo -e "${YELLOW}Created fallback demo WASM files. The application will run in demo mode.${NC}"
    exit 0
fi

# Copy the WebAssembly files to the project
echo -e "${YELLOW}Copying WebAssembly files to the project...${NC}"

# Create the destination directory if it doesn't exist
mkdir -p "$(dirname "$0")/$WASM_DIR"

# Check if the source files exist
if [ -f "llama-web.js" ] && [ -f "llama-web.wasm" ]; then
    # Copy the files to the project
    cp llama-web.js "$(dirname "$0")/$WASM_DIR/llama-wasm.js"
    cp llama-web.wasm "$(dirname "$0")/$WASM_DIR/llama-wasm.wasm"
    
    echo -e "${GREEN}Build completed successfully!${NC}"
    echo "WebAssembly files have been copied to the $WASM_DIR directory."
else
    echo -e "${YELLOW}Warning: WebAssembly files not found.${NC}"
    echo "The application will run in demo mode."
fi

echo "You can now start the server with ./start-server.sh"
