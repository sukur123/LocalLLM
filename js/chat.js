// chat.js - Handles the chat logic and model interactions

class ChatManager {
    constructor() {
        this.chatHistory = [];
        this.isModelLoaded = false;
        this.isGenerating = false;
        this.modelInfo = null;
        
        // The system prompt is used to give the model instructions about its behavior
        this.systemPrompt = "You are a helpful assistant.";
        
        // Event callbacks
        this.callbacks = {
            onModelLoaded: () => {},
            onGenerationStart: () => {},
            onTokenReceived: (token) => {},
            onGenerationComplete: (text) => {},
            onError: (error) => {}
        };
    }

    // Initialize the chat manager
    async initialize(callbacks = {}) {
        // Merge provided callbacks with defaults
        this.callbacks = { ...this.callbacks, ...callbacks };
        
        try {
            // Check for forced demo mode
            const forceDemoMode = new URLSearchParams(window.location.search).get('demo') === 'true';
            console.log("Initialize with forceDemoMode:", forceDemoMode);
            
            // Log the callbacks to verify they're set correctly
            console.log("Callbacks:", Object.keys(this.callbacks));
            
            // Initialize the WASM module
            const wasmInitialized = await window.llamaModel.init('wasm/llama-wasm.js', {
                onStatus: (status) => {
                    console.log("Status update:", status);
                    if (status.includes('error') || status.includes('failed')) {
                        this.callbacks.onError(status);
                    }
                },
                onToken: (token) => {
                    console.log("Token received:", token.substring(0, 10) + (token.length > 10 ? "..." : ""));
                    this.callbacks.onTokenReceived(token);
                },
                onComplete: (text) => {
                    console.log("Generation complete callback, text:", text.substring(0, 20) + "...");
                    this.finishGeneration(text);
                },
                forceDemoMode: forceDemoMode
            });
            
            if (!wasmInitialized) {
                throw new Error('Failed to initialize WASM module');
            }
            
            // Preload the model (this could be deferred until user action)
            return this.loadModel();
        } catch (error) {
            console.error('Initialization error:', error);
            this.callbacks.onError(`Failed to initialize: ${error.message}`);
            return false;
        }
    }

    // Load the model file
    async loadModel() {
        try {
            // Check if we're in demo mode
            if (window.llamaModel.isDemoMode) {
                console.log("Demo mode detected, skipping actual model loading");
                this.isModelLoaded = true;
                this.modelInfo = window.llamaModel.getModelInfo();
                this.callbacks.onModelLoaded(this.modelInfo);
                return true;
            }
            
            // Try to load model configuration if available
            let configuredModelPath = null;
            try {
                const configResponse = await fetch('models/config.json');
                if (configResponse.ok) {
                    const config = await configResponse.json();
                    if (config.modelPath) {
                        configuredModelPath = config.modelPath;
                        console.log(`Found configured model path: ${configuredModelPath}`);
                    }
                }
            } catch (err) {
                console.warn("No valid model configuration found:", err);
            }
            
            // Try to load the model - try multiple possible model files in order of preference
            const modelPaths = [
                // First try the configured model path if available
                ...(configuredModelPath ? [configuredModelPath] : []),
                'models/HuggingFaceTB.SmolLM2-135M-Instruct.Q2_K.gguf', // The smallest one first (135MB)
                'models/tinyllama-1.1b-chat-v1.0.Q4_K.gguf',            // TinyLlama (1.1GB)
                'models/phi-2.Q4_K.gguf',                               // Phi-2 (1.2GB)
                'models/stablelm-zephyr-3b.Q4_K.gguf',                  // StableLM (1.9GB)
                'models/model.gguf'                                      // Generic fallback
            ];
            
            let modelLoaded = false;
            let lastError = null;
            
            // Try each model path until one works
            for (const modelPath of modelPaths) {
                try {
                    console.log(`Trying to load model from ${modelPath}...`);
                    
                    // Check if file exists first
                    try {
                        const checkResponse = await fetch(modelPath, { method: 'HEAD' });
                        if (!checkResponse.ok) {
                            console.warn(`Model file ${modelPath} doesn't exist, skipping`);
                            continue;
                        }
                    } catch (err) {
                        console.warn(`Cannot access ${modelPath}:`, err);
                        continue;
                    }
                    
                    modelLoaded = await window.llamaModel.loadModel(modelPath);
                    if (modelLoaded) {
                        console.log(`Successfully loaded model from ${modelPath}`);
                        break;
                    }
                } catch (err) {
                    lastError = err;
                    console.warn(`Failed to load model from ${modelPath}:`, err);
                }
            }
            
            if (!modelLoaded) {
                throw new Error(lastError || 'Failed to load model from any path');
            }
            
            this.isModelLoaded = true;
            this.modelInfo = window.llamaModel.getModelInfo();
            this.callbacks.onModelLoaded(this.modelInfo);
            return true;
        } catch (error) {
            console.error('Model loading error:', error);
            this.callbacks.onError(`Failed to load model: ${error.message}`);
            return false;
        }
    }

    // Format the chat history into a prompt for the LLM
    formatPrompt() {
        let prompt = this.systemPrompt + "\n\n";
        
        for (const message of this.chatHistory) {
            if (message.role === 'user') {
                prompt += `User: ${message.content}\n`;
            } else if (message.role === 'assistant') {
                prompt += `Assistant: ${message.content}\n\n`;
            }
        }
        
        // Add the assistant prefix for the response
        prompt += "Assistant:";
        
        return prompt;
    }

    // Add a message to the chat history
    addMessage(role, content) {
        this.chatHistory.push({ role, content, timestamp: new Date() });
        return this.chatHistory.length - 1; // Return the index of the added message
    }

    // Send a user message and get a response
    async sendMessage(userMessage) {
        if (!this.isModelLoaded) {
            this.callbacks.onError('Model is not loaded');
            return false;
        }
        
        if (this.isGenerating) {
            this.callbacks.onError('Already generating a response');
            return false;
        }
        
        // Add user message to history
        this.addMessage('user', userMessage);
        
        try {
            this.isGenerating = true;
            this.callbacks.onGenerationStart();
            
            // Format the full prompt with chat history
            const prompt = this.formatPrompt();
            console.log("Formatted prompt:", prompt);
            
            // Start generation
            try {
                const result = await window.llamaModel.generateText(prompt, {
                    temperature: 0.7,
                    maxTokens: 1024,
                    topK: 40,
                    topP: 0.9,
                    repetitionPenalty: 1.1,
                    stopSequences: ["\nUser:", "\n\nUser:"]
                });
                
                console.log("Generation returned:", result);
                // The onComplete callback should be handled automatically
            } catch (error) {
                console.error("Error in generateText:", error);
                this.callbacks.onError(`Generation failed: ${error.message}`);
                this.isGenerating = false;
            }
            
            return true;
        } catch (error) {
            console.error('Generation error:', error);
            this.isGenerating = false;
            this.callbacks.onError(`Failed to generate response: ${error.message}`);
            return false;
        }
    }

    // Stop the current generation
    stopGeneration() {
        if (this.isGenerating) {
            window.llamaModel.stopGeneration();
            this.isGenerating = false;
            return true;
        }
        return false;
    }

    // Called when generation is complete
    finishGeneration(text) {
        console.log("Generation complete, text:", text);
        
        // Clean up the generated text
        const cleanedText = text.trim();
        
        // Add assistant message to history
        this.addMessage('assistant', cleanedText);
        
        // Update state
        this.isGenerating = false;
        
        // Call the callback
        this.callbacks.onGenerationComplete(cleanedText);
    }

    // Clear the chat history
    clearHistory() {
        this.chatHistory = [];
    }

    // Get memory usage information
    getMemoryUsage() {
        if (this.isModelLoaded) {
            return window.llamaModel.getModelInfo().memoryUsageMB + ' MB';
        }
        return 'N/A';
    }
}

// Create global instance
window.chatManager = new ChatManager();
