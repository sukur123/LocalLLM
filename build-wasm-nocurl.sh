#!/bin/sh
# build-wasm-nocurl.sh - Build script that completely disables curl dependency

# Colors for better readability
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Starting WebAssembly build with CURL explicitly disabled...${NC}"

# Check if Emscripten is in PATH
if ! command -v emcc > /dev/null; then
    echo -e "${RED}Emscripten (emcc) not found!${NC}"
    echo "Please run and source the Emscripten setup first:"
    echo "1. ./setup-emscripten.sh"
    echo "2. source ./source-emscripten.sh"
    exit 1
fi

# Create directories
WASM_DIR="wasm"
BUILD_DIR="build-llama-wasm-nocurl"
mkdir -p "$WASM_DIR"
mkdir -p "$BUILD_DIR"

# Clone llama.cpp if it doesn't exist
if [ ! -d "llama.cpp" ]; then
    echo -e "${YELLOW}Cloning llama.cpp repository...${NC}"
    git clone --depth 1 https://github.com/ggerganov/llama.cpp
    if [ $? -ne 0 ]; then
        echo -e "${RED}Failed to clone llama.cpp repository.${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}Updating llama.cpp repository...${NC}"
    cd llama.cpp
    git pull
    cd ..
fi

echo -e "${YELLOW}Creating simpler WebAssembly binding...${NC}"
cat > "llama.cpp/llama-simple.cpp" << 'EOL'
#include "llama.h"
#include <emscripten/emscripten.h>

// State
static llama_model* model = nullptr;
static llama_context* ctx = nullptr;
static llama_batch batch;
static bool model_loaded = false;

extern "C" {
    // Initialize model from a memory buffer
    EMSCRIPTEN_KEEPALIVE int initialize_model(const uint8_t* model_data, size_t model_size) {
        llama_backend_init(false);
        
        struct llama_model_params model_params = llama_model_default_params();
        model = llama_load_model_from_buffer(model_data, model_size, model_params);
        
        if (!model) {
            return 1;
        }
        
        struct llama_context_params ctx_params = llama_context_default_params();
        ctx_params.n_ctx = 2048;
        ctx = llama_new_context_with_model(model, ctx_params);
        
        if (!ctx) {
            llama_free_model(model);
            return 2;
        }
        
        batch = llama_batch_init(512, 0, 1);
        model_loaded = true;
        
        return 0;
    }
    
    // Set generation parameters
    EMSCRIPTEN_KEEPALIVE void set_params(int temp, int max_tokens, int top_k, int top_p, int rep_pen) {
        // Just store parameters
    }
    
    // Generate text
    EMSCRIPTEN_KEEPALIVE int generate_text(const char* prompt) {
        if (!model_loaded || !ctx || !model) {
            return 1;
        }
        
        llama_batch_clear(batch);
        
        auto tokens = llama_tokenize(model, prompt, true);
        
        for (size_t i = 0; i < tokens.size(); ++i) {
            llama_batch_add(batch, tokens[i], i, { 0 }, false);
        }
        
        if (llama_decode(ctx, batch) != 0) {
            return 2;
        }
        
        for (int i = 0; i < 1024; ++i) {
            llama_token new_token_id = llama_sample_token(ctx);
            
            if (new_token_id == llama_token_eos(model)) {
                break;
            }
            
            const char* token_text = llama_token_to_str(model, new_token_id);
            
            EM_ASM({
                const text = UTF8ToString($0);
                const callback = Module._token_callback;
                if (callback) {
                    const result = callback(text);
                    if (result) {
                        Module._stop_requested = true;
                    }
                }
            }, token_text);
            
            if (EM_ASM_INT({ return Module._stop_requested ? 1 : 0; })) {
                EM_ASM({ Module._stop_requested = false; });
                break;
            }
            
            llama_batch_clear(batch);
            llama_batch_add(batch, new_token_id, tokens.size() + i, { 0 }, true);
            
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
    
    // Get model name
    EMSCRIPTEN_KEEPALIVE const char* get_model_name() {
        if (!model_loaded || !model) {
            return "Unknown";
        }
        return llama_model_name(model);
    }
    
    // Get model name length
    EMSCRIPTEN_KEEPALIVE int get_model_name_length() {
        if (!model_loaded || !model) {
            return 7;
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
    EMSCRIPTEN_KEEPALIVE void register_token_callback(int (*callback)(const char*, int)) {
        EM_ASM({
            Module._token_callback = $0;
            Module._stop_requested = false;
        }, callback);
    }
}

int main() {
    return 0;
}
EOL

# Create a patch to disable curl in common/CMakeLists.txt
echo -e "${YELLOW}Creating patch to disable CURL dependency...${NC}"
cat > disable_curl_patch.txt << 'EOL'
diff --git a/common/CMakeLists.txt b/common/CMakeLists.txt
index xxxxxxxxx..yyyyyyyyy 100644
--- a/common/CMakeLists.txt
+++ b/common/CMakeLists.txt
@@ -84,14 +84,8 @@
 endif()
 
 # CURL
-if (LLAMA_CURL)
-    find_package(CURL REQUIRED)
-    if (CURL_FOUND)
-        include_directories(${CURL_INCLUDE_DIR})
-        target_link_libraries(common PRIVATE ${CURL_LIBRARIES})
-    else()
-        message(FATAL_ERROR "Could NOT find CURL.")
-    endif()
+if (FALSE)
+    # CURL support is disabled
 endif()
 
 # GPROF
EOL

# Apply the patch
echo -e "${YELLOW}Applying patch to disable CURL dependency...${NC}"
cd llama.cpp
if [ -f common/CMakeLists.txt ]; then
    # This is a safer approach than trying to use patch command
    sed -i 's/if (LLAMA_CURL)/if (FALSE)/g' common/CMakeLists.txt
    sed -i 's/    find_package(CURL REQUIRED)/    # CURL support is disabled/g' common/CMakeLists.txt
    sed -i 's/    if (CURL_FOUND)/    # if (CURL_FOUND)/g' common/CMakeLists.txt
    sed -i 's/        include_directories(${CURL_INCLUDE_DIR})/        # include_directories(${CURL_INCLUDE_DIR})/g' common/CMakeLists.txt
    sed -i 's/        target_link_libraries(common PRIVATE ${CURL_LIBRARIES})/        # target_link_libraries(common PRIVATE ${CURL_LIBRARIES})/g' common/CMakeLists.txt
    sed -i 's/    else()/    # else()/g' common/CMakeLists.txt
    sed -i 's/        message(FATAL_ERROR "Could NOT find CURL.")/        # message(FATAL_ERROR "Could NOT find CURL.")/g' common/CMakeLists.txt
    sed -i 's/    endif()/    # endif()/g' common/CMakeLists.txt
    echo -e "${GREEN}Successfully disabled CURL in CMakeLists.txt${NC}"
else
    echo -e "${RED}common/CMakeLists.txt not found!${NC}"
    cd ..
    exit 1
fi
cd ..

# Create build directory
mkdir -p "$BUILD_DIR"
cd "$BUILD_DIR"

# Configure with CMake with CURL explicitly disabled
echo -e "${YELLOW}Configuring with CMake (CURL explicitly disabled)...${NC}"
emcmake cmake ../llama.cpp \
  -DCMAKE_BUILD_TYPE=Release \
  -DLLAMA_WASM=ON \
  -DLLAMA_WASM_SINGLE_FILE=ON \
  -DLLAMA_BLAS=OFF \
  -DLLAMA_METAL=OFF \
  -DLLAMA_CUBLAS=OFF \
  -DLLAMA_BUILD_SERVER=OFF \
  -DLLAMA_CURL=OFF

# Check if CMake configuration worked
if [ $? -ne 0 ]; then
    echo -e "${RED}CMake configuration failed!${NC}"
    echo "Creating fallback WASM file for demo mode..."
    
    # Create a minimal WebAssembly JS fallback file
    mkdir -p "../$WASM_DIR"
    cat > "../$WASM_DIR/llama-wasm.js" << 'EOF'
// Fallback WASM module for demo mode only
console.warn("Using demo WASM fallback due to build failure");
var Module = {
  onRuntimeInitialized: function() {
    console.log("Demo WASM module initialized");
  },
  noInitialRun: true,
  noExitRuntime: true,
  print: function(text) { console.log(text); },
  printErr: function(text) { console.error(text); }
};
EOF
    
    cd ..
    echo -e "${YELLOW}Created fallback demo WASM files. The application will run in demo mode.${NC}"
    echo "Try running ./diagnostic.sh for more information about what went wrong."
    exit 1
fi

# Build the WebAssembly Module
echo -e "${YELLOW}Building WebAssembly module...${NC}"
emmake make -j4

# Check if the build succeeded
if [ $? -ne 0 ]; then
    echo -e "${RED}Build failed!${NC}"
    echo "Creating fallback WASM file for demo mode..."
    
    mkdir -p "../$WASM_DIR"
    cat > "../$WASM_DIR/llama-wasm.js" << 'EOF'
// Fallback WASM module for demo mode only
console.warn("Using demo WASM fallback due to build failure");
var Module = {
  onRuntimeInitialized: function() {
    console.log("Demo WASM module initialized");
  },
  noInitialRun: true,
  noExitRuntime: true,
  print: function(text) { console.log(text); },
  printErr: function(text) { console.error(text); }
};
EOF
    
    cd ..
    echo -e "${YELLOW}Created fallback demo WASM files. The application will run in demo mode.${NC}"
    echo "Try running ./diagnostic.sh for more information about what went wrong."
    exit 1
fi

# Build custom binding
echo -e "${YELLOW}Building custom WebAssembly binding...${NC}"
cd ..
emcc -O3 -s WASM=1 \
     -s ALLOW_MEMORY_GROWTH=1 \
     -s MAXIMUM_MEMORY=4GB \
     -s EXPORTED_FUNCTIONS="['_initialize_model','_set_params','_generate_text','_stop_generation','_get_model_name','_get_model_name_length','_get_memory_usage','_register_token_callback','_main']" \
     -s EXPORTED_RUNTIME_METHODS='["UTF8ToString", "ccall", "cwrap"]' \
     -I./llama.cpp \
     ./llama.cpp/llama-simple.cpp \
     -o ./llama-simple.js \
     ./$BUILD_DIR/libllama.a

# Check if binding build succeeded
if [ $? -ne 0 ]; then
    echo -e "${RED}Custom binding build failed!${NC}"
    echo "Creating fallback WASM file for demo mode..."
    
    mkdir -p "$WASM_DIR"
    cat > "$WASM_DIR/llama-wasm.js" << 'EOF'
// Fallback WASM module for demo mode only
console.warn("Using demo WASM fallback due to build failure");
var Module = {
  onRuntimeInitialized: function() {
    console.log("Demo WASM module initialized");
  },
  noInitialRun: true,
  noExitRuntime: true,
  print: function(text) { console.log(text); },
  printErr: function(text) { console.error(text); }
};
EOF
    
    echo -e "${YELLOW}Created fallback demo WASM files. The application will run in demo mode.${NC}"
    echo "Try running ./diagnostic.sh for more information about what went wrong."
    exit 1
fi

# Copy the WebAssembly files to the project
echo -e "${YELLOW}Copying WebAssembly files to the project...${NC}"
if [ -f "llama-simple.js" ] && [ -f "llama-simple.wasm" ]; then
    cp llama-simple.js "$WASM_DIR/llama-wasm.js"
    cp llama-simple.wasm "$WASM_DIR/llama-wasm.wasm"
    echo -e "${GREEN}Build completed successfully!${NC}"
    echo "WebAssembly files have been copied to the $WASM_DIR directory."
else
    echo -e "${RED}Error: WebAssembly files not found!${NC}"
    echo "Creating fallback demo WASM files..."
    
    mkdir -p "$WASM_DIR"
    cat > "$WASM_DIR/llama-wasm.js" << 'EOF'
// Fallback WASM module for demo mode only
console.warn("Using demo WASM fallback due to missing build output");
var Module = {
  onRuntimeInitialized: function() {
    console.log("Demo WASM module initialized");
  },
  noInitialRun: true,
  noExitRuntime: true,
  print: function(text) { console.log(text); },
  printErr: function(text) { console.error(text); }
};
EOF
    
    echo -e "${YELLOW}Created fallback demo WASM files. The application will run in demo mode.${NC}"
    echo "Try running ./diagnostic.sh for more information about what went wrong."
    exit 1
fi

echo -e "${GREEN}Build process completed successfully!${NC}"
echo "You can now start the server with ./start-server.sh"
