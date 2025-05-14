# Building llama.cpp for WebAssembly

This guide outlines the steps to compile llama.cpp to WebAssembly for running in a browser environment.

## Prerequisites

- Emscripten SDK: [https://emscripten.org/docs/getting_started/downloads.html](https://emscripten.org/docs/getting_started/downloads.html)
- llama.cpp repository: [https://github.com/ggerganov/llama.cpp](https://github.com/ggerganov/llama.cpp)
- CMake (3.14 or later)
- Git

## Setup and Build Instructions

1. **Install Emscripten SDK**

   ```bash
   git clone https://github.com/emscripten-core/emsdk.git
   cd emsdk
   ./emsdk install latest
   ./emsdk activate latest
   source ./emsdk_env.sh
   ```

2. **Clone llama.cpp repository**

   ```bash
   git clone https://github.com/ggerganov/llama.cpp
   cd llama.cpp
   ```

3. **Prepare Build Directory**

   ```bash
   mkdir build-web
   cd build-web
   ```

4. **Configure with CMake**

   ```bash
   emcmake cmake .. \
     -DCMAKE_BUILD_TYPE=Release \
     -DLLAMA_WASM=ON \
     -DLLAMA_WASM_SINGLE_FILE=ON \
     -DLLAMA_BLAS=OFF \
     -DLLAMA_METAL=OFF \
     -DLLAMA_CUBLAS=OFF \
     -DLLAMA_BUILD_SERVER=OFF
   ```

5. **Build the WebAssembly Module**

   ```bash
   emmake make -j
   ```

6. **Create JavaScript Bindings**

   The default build doesn't expose all the functions we need, so we need to create a custom binding. Create a file called `llama-web.cpp` in the llama.cpp root directory:

   ```cpp
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
           for (int i = 0; i < max_tokens; ++i) {
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
   ```

7. **Build the Custom Module**

   ```bash
   em++ -O3 -s WASM=1 -s ALLOW_MEMORY_GROWTH=1 \
     -s TOTAL_MEMORY=1GB \
     -s EXPORTED_RUNTIME_METHODS=['ccall','cwrap'] \
     -s EXPORTED_FUNCTIONS=['_malloc','_free','_initialize_model','_set_params','_generate_text','_stop_generation','_get_model_name','_get_model_name_length','_get_memory_usage','_register_token_callback'] \
     -I../ \
     llama-web.cpp ../build-web/libllama.a \
     -o llama-wasm.js
   ```

8. **Copy the Generated Files**

   After the build process completes, copy the generated WebAssembly files to your project:

   ```bash
   cp llama-wasm.js llama-wasm.wasm /path/to/your/project/wasm/
   ```

## Additional Tips

- Make sure to handle memory properly in the JavaScript code.
- Using small models (like TinyLlama 1.1B or Mistral 7B) will work better in browser environments due to memory constraints.
- Consider adding quantized model support (4-bit or 2-bit) to reduce model size and memory requirements.
- The WebAssembly build should be optimized as much as possible for browser performance.
