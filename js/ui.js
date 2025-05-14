// ui.js - Handles the UI interactions and updates

class UIManager {
    constructor() {
        // UI elements
        this.chatMessagesEl = document.getElementById('chat-messages');
        this.userInputEl = document.getElementById('user-input');
        this.sendButtonEl = document.getElementById('send-button');
        this.statusEl = document.getElementById('status');
        this.modelNameEl = document.getElementById('model-name');
        this.memoryUsageEl = document.getElementById('memory-usage');
        
        // State
        this.currentResponse = '';
        this.isGenerating = false;
        
        // Throttling for updates during generation
        this.lastUpdateTime = 0;
        this.updateThrottleMs = 50; // Update UI at most every 50ms
        
        // Initialize event listeners
        this.initEventListeners();
        
        // Initialize the chat manager
        this.initChatManager();
    }

    // Initialize event listeners
    initEventListeners() {
        // Send button click
        this.sendButtonEl.addEventListener('click', () => this.sendMessage());
        
        // Enter key to send
        this.userInputEl.addEventListener('keydown', (e) => {
            // Check if Enter is pressed without Shift
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        
        // Auto-resize textarea
        this.userInputEl.addEventListener('input', () => {
            this.userInputEl.style.height = 'auto';
            this.userInputEl.style.height = (this.userInputEl.scrollHeight) + 'px';
        });
        
        // Demo mode button
        const demoModeButton = document.getElementById('demo-mode-button');
        if (demoModeButton) {
            demoModeButton.addEventListener('click', () => {
                // Force demo mode
                window.location.href = window.location.href.split('?')[0] + '?demo=true';
            });
        }
        
        // Check for demo mode parameter
        if (new URLSearchParams(window.location.search).get('demo') === 'true') {
            this.updateStatus('Forcing demo mode...');
            // We'll handle this in the initChatManager method
        }
    }

    // Initialize the chat manager
    async initChatManager() {
        this.updateStatus('Initializing...');
        
        // Check for demo mode parameter
        const forceDemoMode = new URLSearchParams(window.location.search).get('demo') === 'true';
        if (forceDemoMode) {
            this.updateStatus('Forced demo mode active');
            
            // Set the model to demo mode directly
            window.llamaModel.simulateWasmFunctionality();
            window.llamaModel.modelLoaded = true;
            window.llamaModel.isDemoMode = true;
            
            // Update UI
            this.updateStatus('Demo mode loaded successfully');
            this.updateModelInfo({
                loaded: true,
                name: "Demo Model (Forced)",
                memoryUsageMB: "100.00"
            });
            this.sendButtonEl.disabled = false;
            
            // Add a demo mode indicator
            const demoIndicator = document.createElement('div');
            demoIndicator.className = 'demo-indicator';
            demoIndicator.textContent = 'DEMO MODE';
            document.querySelector('header').appendChild(demoIndicator);
            
            // Add welcome message
            this.addBotMessage("Hello! I'm running in demo mode. Real models aren't loaded, but you can still test the interface with pre-programmed responses.");
            return;
        }
        
        const initialized = await window.chatManager.initialize({
            onModelLoaded: (info) => {
                this.updateStatus('Model loaded successfully');
                this.updateModelInfo(info);
                this.sendButtonEl.disabled = false;
                
                // Add welcome message
                this.addBotMessage("Hello! I'm a local LLM running completely in your browser. How can I help you today?");
            },
            onGenerationStart: () => {
                this.isGenerating = true;
                this.currentResponse = '';
                this.addThinkingIndicator();
                this.sendButtonEl.disabled = true;
                this.sendButtonEl.textContent = 'Stop';
                this.sendButtonEl.onclick = () => this.stopGeneration();
            },
            onTokenReceived: (token) => {
                this.currentResponse += token;
                
                // Throttle UI updates to avoid performance issues
                const now = Date.now();
                if (now - this.lastUpdateTime > this.updateThrottleMs) {
                    this.updateGeneratingMessage(this.currentResponse);
                    this.lastUpdateTime = now;
                }
            },
            onGenerationComplete: (text) => {
                this.removeThinkingIndicator();
                this.updateGeneratingMessage(text, true);
                this.isGenerating = false;
                this.sendButtonEl.disabled = false;
                this.sendButtonEl.textContent = 'Send';
                this.sendButtonEl.onclick = () => this.sendMessage();
                
                // Update memory usage
                this.memoryUsageEl.textContent = `Memory: ${window.chatManager.getMemoryUsage()}`;
            },
            onError: (error) => {
                this.updateStatus(`Error: ${error}`);
                this.isGenerating = false;
                this.sendButtonEl.disabled = false;
                this.sendButtonEl.textContent = 'Send';
                this.sendButtonEl.onclick = () => this.sendMessage();
                
                // Suggest demo mode on error
                if (error.includes('Model is not loaded') || error.includes('Failed to load model')) {
                    const errorMsg = document.createElement('div');
                    errorMsg.className = 'message system-message error-message';
                    errorMsg.innerHTML = `
                        <strong>Error:</strong> ${error}
                        <br><br>
                        <strong>Troubleshooting:</strong>
                        <ol>
                            <li>Make sure you have downloaded a GGUF model file using <code>./download-models.sh</code></li>
                            <li>Make sure you have built the WebAssembly module using <code>./build-wasm-simple.sh</code></li>
                            <li>Try using a smaller model if your browser has memory limitations</li>
                            <li>Run <code>./diagnostic.sh</code> to check your environment</li>
                            <li>You can <a href="javascript:void(0)" onclick="window.switchToDemoMode()">switch to demo mode</a> to test the interface without a real model</li>
                        </ol>
                    `;
                    this.chatMessagesEl.appendChild(errorMsg);
                    this.scrollToBottom();
                } else if (error.includes('WebAssembly') || error.includes('build') || error.includes('wasm')) {
                    // WebAssembly build error
                    const errorMsg = document.createElement('div');
                    errorMsg.className = 'message system-message error-message';
                    errorMsg.innerHTML = `
                        <strong>WebAssembly Build Error:</strong> ${error}
                        <br><br>
                        <strong>Solutions:</strong>
                        <ol>
                            <li>Install dependencies: <code>./install-dependencies.sh</code></li>
                            <li>Set up Emscripten: <code>./setup-emscripten.sh</code></li>
                            <li>Source the environment: <code>source ./source-emscripten.sh</code></li>
                            <li>Try the simplified build: <code>./build-wasm-simple.sh</code></li>
                            <li>Check your environment: <code>./diagnostic.sh</code></li>
                            <li>You can <a href="javascript:void(0)" onclick="window.switchToDemoMode()">switch to demo mode</a> to test the interface</li>
                        </ol>
                    `;
                    this.chatMessagesEl.appendChild(errorMsg);
                    this.scrollToBottom();
                }
            }
        });
        
        // Add a global function to switch to demo mode
        window.switchToDemoMode = function() {
            window.location.href = window.location.href.split('?')[0] + '?demo=true';
        };
        
        if (!initialized) {
            this.updateStatus('Failed to initialize the chat system');
        }
    }

    // Send a message
    sendMessage() {
        if (this.isGenerating) {
            this.stopGeneration();
            return;
        }
        
        const userInput = this.userInputEl.value.trim();
        if (!userInput) return;
        
        // Add user message to UI
        this.addUserMessage(userInput);
        
        // Clear input field
        this.userInputEl.value = '';
        this.userInputEl.style.height = 'auto';
        
        // Send message to chat manager
        window.chatManager.sendMessage(userInput);
    }

    // Stop the current generation
    stopGeneration() {
        if (!this.isGenerating) return;
        
        window.chatManager.stopGeneration();
        this.removeThinkingIndicator();
        
        // Finalize the current response
        if (this.currentResponse) {
            this.updateGeneratingMessage(this.currentResponse + ' [stopped]', true);
        }
        
        this.isGenerating = false;
        this.sendButtonEl.disabled = false;
        this.sendButtonEl.textContent = 'Send';
        this.sendButtonEl.onclick = () => this.sendMessage();
    }

    // Add a user message to the chat
    addUserMessage(text) {
        const messageEl = document.createElement('div');
        messageEl.className = 'message user-message';
        messageEl.textContent = text;
        this.chatMessagesEl.appendChild(messageEl);
        this.scrollToBottom();
    }

    // Add a bot message to the chat
    addBotMessage(text) {
        const messageEl = document.createElement('div');
        messageEl.className = 'message bot-message';
        messageEl.textContent = text;
        this.chatMessagesEl.appendChild(messageEl);
        this.scrollToBottom();
        return messageEl;
    }

    // Add thinking indicator
    addThinkingIndicator() {
        const indicatorEl = document.createElement('div');
        indicatorEl.className = 'message bot-message thinking';
        indicatorEl.id = 'thinking-indicator';
        
        for (let i = 0; i < 3; i++) {
            const dot = document.createElement('div');
            dot.className = 'dot';
            indicatorEl.appendChild(dot);
        }
        
        this.chatMessagesEl.appendChild(indicatorEl);
        this.scrollToBottom();
    }

    // Remove thinking indicator
    removeThinkingIndicator() {
        const indicatorEl = document.getElementById('thinking-indicator');
        if (indicatorEl) {
            indicatorEl.remove();
        }
    }

    // Update the currently generating message
    updateGeneratingMessage(text, isComplete = false) {
        console.log("Updating message:", text.substring(0, 50) + "...", "isComplete:", isComplete);
        
        let messageEl = document.getElementById('generating-message');
        
        if (!messageEl) {
            console.log("Creating new message element");
            this.removeThinkingIndicator();
            messageEl = document.createElement('div');
            messageEl.className = 'message bot-message';
            messageEl.id = 'generating-message';
            this.chatMessagesEl.appendChild(messageEl);
        }
        
        // Convert newlines to <br> tags for proper display
        const formattedText = text.replace(/\n/g, '<br>');
        messageEl.innerHTML = formattedText;
        
        // If complete, remove the ID so future messages can be generated
        if (isComplete) {
            console.log("Message complete, removing ID");
            messageEl.removeAttribute('id');
        }
        
        this.scrollToBottom();
    }

    // Update status message
    updateStatus(text) {
        // Add visual indicator for demo mode
        if (text.includes('demo mode')) {
            this.statusEl.innerHTML = 'Status: <strong style="color: #ff6700;">DEMO MODE</strong> - ' + 
                text.replace('demo mode', '').replace('running in', '');
            
            // Add a CSS class for additional styling
            this.statusEl.classList.add('demo-mode');
        } else {
            this.statusEl.textContent = `Status: ${text}`;
            this.statusEl.classList.remove('demo-mode');
        }
    }

    // Update model info display
    updateModelInfo(info) {
        if (info && info.loaded) {
            this.modelNameEl.textContent = `Model: ${info.name || 'Unknown'}`;
            this.memoryUsageEl.textContent = `Memory: ${info.memoryUsageMB || 'Unknown'} MB`;
        } else {
            this.modelNameEl.textContent = 'Model: Not loaded';
            this.memoryUsageEl.textContent = 'Memory: N/A';
        }
    }

    // Scroll to the bottom of the chat
    scrollToBottom() {
        this.chatMessagesEl.scrollTop = this.chatMessagesEl.scrollHeight;
    }
}

// Initialize the UI when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.uiManager = new UIManager();
});
