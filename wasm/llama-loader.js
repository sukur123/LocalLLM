// filepath: /home/sukur/Desktop/localLLMWeb/wasm/llama-loader.js
// llama-loader.js - Handles the WebAssembly module loading and interactions

class LlamaModel {
    constructor() {
        this.module = null;
        this.memory = null;
        this.modelLoaded = false;
        this.generating = false;
        this.callbacks = {
            onStatus: (msg) => console.log(`Status: ${msg}`),
            onToken: (token) => console.log(`Token: ${token}`),
            onComplete: (text) => console.log(`Complete: ${text}`)
        };
    }

    // Initialize the WASM module
    async init(wasmPath, callbacks = {}) {
        try {
            // Merge provided callbacks with defaults
            this.callbacks = { ...this.callbacks, ...callbacks };
            this.callbacks.onStatus('Initializing WebAssembly module...');
            
            // Check if demo mode is forced
            if (callbacks.forceDemoMode) {
                this.callbacks.onStatus('Force demo mode enabled - skipping WASM initialization');
                this.simulateWasmFunctionality();
                return true;
            }

            // Check if wasmPath exists
            try {
                const wasmCheck = await fetch(wasmPath, { method: 'HEAD' });
                if (!wasmCheck.ok) {
                    // WASM file doesn't exist - in development/demo mode
                    this.callbacks.onStatus('WASM files not found - running in demo mode');
                    this.simulateWasmFunctionality();
                    return true;
                }
            } catch (e) {
                // Fetch failed - assume WASM is not available
                this.callbacks.onStatus('WASM files not available - running in demo mode');
                this.simulateWasmFunctionality();
                return true;
            }

            // Fetch and instantiate the WebAssembly module
            try {
                const response = await fetch(wasmPath);
                const buffer = await response.arrayBuffer();
                
                // Create import object with necessary JavaScript functions
                const importObject = {
                    env: {
                        emscripten_notify_memory_growth: () => {}
                    },
                    wasi_snapshot_preview1: {
                        fd_close: () => 0,
                        fd_write: () => 0,
                        fd_seek: () => 0,
                        proc_exit: () => {}
                    }
                };
                
                const result = await WebAssembly.instantiate(buffer, importObject);
                
                this.module = result.instance.exports;
                this.memory = this.module.memory;
                this.callbacks.onStatus('WebAssembly module initialized');
                return true;
            } catch (error) {
                // If WASM instantiation fails, fall back to demo mode
                this.callbacks.onStatus(`WebAssembly instantiation failed - running in demo mode: ${error.message}`);
                this.simulateWasmFunctionality();
                return true;
            }
        } catch (error) {
            this.callbacks.onStatus(`Failed to initialize: ${error.message}`);
            console.error('WebAssembly initialization error:', error);
            return false;
        }
    }

    // Simulate WASM functionality for demo purposes
    simulateWasmFunctionality() {
        this.callbacks.onStatus('Initializing demo mode...');
        
        // Set demo mode flag
        this.isDemoMode = true;
        
        // Create a simulated module with basic functionality
        this.module = {
            // Simulate memory functions
            _malloc: (size) => 1, // Return dummy pointer
            _free: (ptr) => {},   // Do nothing for free
            
            // Simulate model functions
            _initialize_model: () => 0, // Return success code
            _set_params: () => {},
            _generate_text: () => 0,    // Return success code
            _stop_generation: () => {},
            _get_model_name: () => 0,   // Return pointer to name
            _get_model_name_length: () => 10, // Return length of name
            _get_memory_usage: () => 100 * 1024 * 1024, // Return 100MB
            _register_token_callback: () => {}
        };
        
        // Mock memory
        this.memory = new ArrayBuffer(1024);
        
        // Set demo model name
        const encoder = new TextEncoder();
        const nameBytes = encoder.encode("Demo Model");
        const nameArray = new Uint8Array(this.memory, 0, nameBytes.length);
        nameArray.set(nameBytes);
        
        this.callbacks.onStatus('Demo mode initialized');
    }

    // Load the GGUF model file
    async loadModel(modelPath) {
        if (!this.module) {
            this.callbacks.onStatus('Module not initialized');
            return false;
        }

        try {
            this.callbacks.onStatus('Loading model...');
            
            // Check if running in demo mode
            if (this.isDemoMode) {
                // In demo mode, simulate successful model loading
                this.modelLoaded = true;
                this.callbacks.onStatus('Demo model loaded successfully');
                return true;
            }
            
            // Check if model file exists
            try {
                const modelCheck = await fetch(modelPath, { method: 'HEAD' });
                if (!modelCheck.ok) {
                    this.callbacks.onStatus(`Model file not found at ${modelPath} - switching to demo mode`);
                    this.isDemoMode = true;
                    this.modelLoaded = true;
                    return true;
                }
            } catch (e) {
                this.callbacks.onStatus(`Cannot access model file - switching to demo mode: ${e.message}`);
                this.isDemoMode = true;
                this.modelLoaded = true;
                return true;
            }
            
            // Regular model loading logic for when WASM is available
            // Fetch the model file
            const response = await fetch(modelPath);
            if (!response.ok) {
                throw new Error(`Failed to fetch model: ${response.statusText}`);
            }
            
            const modelBuffer = await response.arrayBuffer();
            this.callbacks.onStatus(`Model file loaded (${(modelBuffer.byteLength / (1024 * 1024)).toFixed(2)} MB)`);
            
            // Allocate memory for the model in WASM
            const modelDataPtr = this.module._malloc(modelBuffer.byteLength);
            const modelDataView = new Uint8Array(this.memory, modelDataPtr, modelBuffer.byteLength);
            
            // Copy model data into WASM memory
            const modelDataArray = new Uint8Array(modelBuffer);
            modelDataView.set(modelDataArray);
            
            // Call the model initialization function (this will be implementation-specific)
            const result = this.module._initialize_model(modelDataPtr, modelBuffer.byteLength);
            
            if (result !== 0) {
                throw new Error(`Model initialization failed with code: ${result}`);
            }
            
            // Free the temporary buffer
            this.module._free(modelDataPtr);
            
            this.modelLoaded = true;
            this.callbacks.onStatus('Model loaded successfully');
            return true;
        } catch (error) {
            this.callbacks.onStatus(`Failed to load model: ${error.message} - switching to demo mode`);
            console.error('Model loading error:', error);
            
            // Switch to demo mode on error
            this.isDemoMode = true;
            this.modelLoaded = true;
            
            return true; // Still return true so the app can proceed in demo mode
        }
    }

    // Generate text based on the prompt
    async generateText(prompt, options = {}) {
        if (!this.modelLoaded || !this.module) {
            this.callbacks.onStatus('Model is not loaded');
            return null;
        }

        if (this.generating) {
            this.callbacks.onStatus('Already generating text');
            return null;
        }

        const defaults = {
            temperature: 0.7,
            maxTokens: 512,
            topK: 40,
            topP: 0.9,
            repetitionPenalty: 1.1,
            stopSequences: ["\n\nUser:", "\nUser:"]
        };

        const params = { ...defaults, ...options };

        try {
            this.generating = true;
            this.callbacks.onStatus('Generating response...');

            // Check if running in demo mode
            if (this.isDemoMode) {
                // In demo mode, simulate text generation
                return this.simulateTextGeneration(prompt, params);
            }

            // Regular generation logic for when WASM is available
            try {
                // Allocate memory for prompt
                const promptBuffer = new TextEncoder().encode(prompt);
                const promptPtr = this.module._malloc(promptBuffer.length + 1);
                const promptView = new Uint8Array(this.memory.buffer, promptPtr, promptBuffer.length + 1);
                
                // Copy prompt into WASM memory
                promptView.set(promptBuffer);
                promptView[promptBuffer.length] = 0; // Null terminator
                
                // Configure generation parameters
                this.module._set_params(
                    Math.floor(params.temperature * 100), // Scale for integer representation
                    params.maxTokens,
                    params.topK,
                    Math.floor(params.topP * 100), // Scale for integer representation
                    Math.floor(params.repetitionPenalty * 100) // Scale for integer representation
                );
                
                let fullText = '';
                let stopped = false;
                
                // Setup callback for receiving tokens
                const tokenCallback = (ptr, length) => {
                    if (stopped) return 1; // Signal to stop generation
                    
                    const tokenView = new Uint8Array(this.memory.buffer, ptr, length);
                    const token = new TextDecoder().decode(tokenView);
                    fullText += token;
                    
                    this.callbacks.onToken(token);
                    
                    // Check for stop sequences
                    for (const stopSeq of params.stopSequences) {
                        if (fullText.endsWith(stopSeq)) {
                            stopped = true;
                            fullText = fullText.slice(0, -stopSeq.length);
                            return 1; // Signal to stop generation
                        }
                    }
                    
                    return 0; // Continue generation
                };
                
                // Register the callback
                this.module._register_token_callback(tokenCallback);
                
                // Start generation
                const result = this.module._generate_text(promptPtr);
                
                // Free memory
                this.module._free(promptPtr);
                
                this.generating = false;
                
                if (result !== 0) {
                    throw new Error(`Generation failed with code: ${result}`);
                }
                
                this.callbacks.onStatus('Generation complete');
                this.callbacks.onComplete(fullText);
                
                return fullText;
            } catch (error) {
                // If generation fails, fall back to demo mode
                this.callbacks.onStatus(`Generation failed - using demo response: ${error.message}`);
                return this.simulateTextGeneration(prompt, params);
            }
        } catch (error) {
            this.generating = false;
            this.callbacks.onStatus(`Generation failed: ${error.message}`);
            console.error('Generation error:', error);
            return null;
        }
    }

    // Simulate text generation for demo mode
    async simulateTextGeneration(prompt, params) {
        console.log("========== DEMO MODE GENERATION ==========");
        console.log("Prompt received:", prompt);
        
        // Parse the prompt to extract the user's question
        let userMessage = "";
        try {
            const userMatch = prompt.match(/User:\s*(.*?)(?:\n|$)/);
            if (userMatch && userMatch[1]) {
                userMessage = userMatch[1].trim();
                console.log("Extracted user message:", userMessage);
            } else {
                console.log("Could not extract user message, using whole prompt as fallback");
                userMessage = prompt.trim();
            }
        } catch (e) {
            console.error("Error extracting user message:", e);
            userMessage = "hello"; // Fallback to a simple greeting
        }
        
        // Simple demo responses
        const demoResponses = {
            "hello": "Hello! I'm running in demo mode because the WebAssembly module isn't loaded. In a real implementation, I would be powered by llama.cpp via WebAssembly.",
            "who are you": "I'm a browser-based LLM chatbot running in demo mode. In real implementation, I would be running a GGUF model via llama.cpp compiled to WebAssembly.",
            "what can you do": "In demo mode, I can only respond with pre-programmed answers. In a real implementation, I could generate text, answer questions, and have more intelligent conversations using a local LLM running in your browser.",
            "how do you work": "In a real implementation, I would load a GGUF language model into WebAssembly using llama.cpp, which allows LLMs to run directly in your browser without any server. Right now I'm in demo mode because the WASM files aren't available."
        };
        
        // Default response
        let response = "I'm currently running in demo mode because the WebAssembly files are not available. In a full implementation, I would be powered by a GGUF language model running locally in your browser using llama.cpp compiled to WebAssembly. Try asking me something!";
        
        // Try to match the user message to a demo response
        for (const [key, value] of Object.entries(demoResponses)) {
            if (userMessage.toLowerCase().includes(key)) {
                response = value;
                break;
            }
        }
        
        // Simulate token-by-token generation
        let generatedSoFar = "";
        
        try {
            const words = response.split(" ");
            
            for (let i = 0; i < words.length; i++) {
                const word = words[i] + (i < words.length - 1 ? " " : "");
                generatedSoFar += word;
                
                try {
                    // Call the token callback
                    console.log("Sending token:", word);
                    if (typeof this.callbacks.onToken === 'function') {
                        this.callbacks.onToken(word);
                    } else {
                        console.error("onToken callback is not a function");
                    }
                } catch (e) {
                    console.error("Error in token callback:", e);
                }
                
                // Simulate generation delay
                await new Promise(resolve => setTimeout(resolve, 25 + Math.random() * 50));
                
                // Check for stop sequences
                for (const stopSeq of params.stopSequences) {
                    if (generatedSoFar.endsWith(stopSeq)) {
                        generatedSoFar = generatedSoFar.slice(0, -stopSeq.length);
                        i = words.length; // End the loop
                        break;
                    }
                }
            }
        } catch (e) {
            console.error("Error in token generation loop:", e);
            // Add a fallback response in case of error
            generatedSoFar = "I'm running in demo mode. There was an error generating a response.";
        }
        
        console.log("Generation complete, final text:", generatedSoFar);
        this.generating = false;
        this.callbacks.onStatus('Generation complete');
        
        try {
            if (typeof this.callbacks.onComplete === 'function') {
                this.callbacks.onComplete(generatedSoFar);
            } else {
                console.error("onComplete callback is not a function");
            }
        } catch (e) {
            console.error("Error in complete callback:", e);
        }
        
        return generatedSoFar;
    }

    // Stop the ongoing generation
    stopGeneration() {
        if (this.generating && this.module) {
            // Check if running in demo mode
            if (this.isDemoMode) {
                // In demo mode, just update state
                this.generating = false;
                this.callbacks.onStatus('Generation stopped');
                return true;
            }
            
            // Regular stop logic for when WASM is available
            if (this.module._stop_generation) {
                this.module._stop_generation();
                this.generating = false;
                this.callbacks.onStatus('Generation stopped');
                return true;
            }
        }
        return false;
    }

    // Get model information
    getModelInfo() {
        if (!this.modelLoaded || !this.module) {
            return { loaded: false };
        }

        try {
            // Check if running in demo mode
            if (this.isDemoMode) {
                // Return demo model info
                return {
                    loaded: true,
                    name: "Demo Model (No WASM)",
                    memoryUsage: 100 * 1024 * 1024,
                    memoryUsageMB: "100.00"
                };
            }
            
            // Regular model info logic for when WASM is available
            try {
                const namePtr = this.module._get_model_name();
                const nameLength = this.module._get_model_name_length();
                const nameView = new Uint8Array(this.memory.buffer, namePtr, nameLength);
                const name = new TextDecoder().decode(nameView);

                const memoryUsed = this.module._get_memory_usage();
                
                return {
                    loaded: true,
                    name: name,
                    memoryUsage: memoryUsed,
                    memoryUsageMB: (memoryUsed / (1024 * 1024)).toFixed(2)
                };
            } catch (error) {
                // If getting info fails, return demo info
                console.error('Failed to get model info:', error);
                return {
                    loaded: true,
                    name: "Model Info Error - Using Demo",
                    memoryUsage: 100 * 1024 * 1024,
                    memoryUsageMB: "100.00"
                };
            }
        } catch (error) {
            console.error('Failed to get model info:', error);
            return { loaded: true, error: error.message };
        }
    }
}

// Create global instance
window.llamaModel = new LlamaModel();
