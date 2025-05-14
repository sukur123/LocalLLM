// log.js - Simple logging utility for the local LLM web app

class Logger {
    constructor(options = {}) {
        this.options = {
            logLevel: options.logLevel || 'info', // 'debug', 'info', 'warn', 'error'
            enableConsole: options.enableConsole !== false,
            enableUI: options.enableUI !== false,
            maxLogEntries: options.maxLogEntries || 100,
            enableBuildErrors: options.enableBuildErrors !== false
        };
        
        this.logs = [];
        this.logLevels = {
            debug: 0,
            info: 1,
            warn: 2,
            error: 3
        };
        
        // Create UI logger if enabled
        if (this.options.enableUI) {
            this.createLogUI();
        }
        
        // Set up error monitoring for WASM builds if enabled
        if (this.options.enableBuildErrors) {
            this.monitorBuildErrors();
        }
    }
    
    // Create a simple UI for logs
    createLogUI() {
        // Check if log container already exists
        if (document.getElementById('log-container')) {
            return;
        }
        
        // Create log container
        const logContainer = document.createElement('div');
        logContainer.id = 'log-container';
        logContainer.style.cssText = `
            position: fixed;
            bottom: 0;
            right: 0;
            width: 400px;
            height: 200px;
            background-color: rgba(0, 0, 0, 0.8);
            color: #f0f0f0;
            font-family: monospace;
            font-size: 12px;
            z-index: 9999;
            overflow-y: auto;
            padding: 10px;
            border-top-left-radius: 5px;
            display: none;
        `;
        
        // Create log content
        const logContent = document.createElement('div');
        logContent.id = 'log-content';
        logContainer.appendChild(logContent);
        
        // Create toggle button
        const toggleButton = document.createElement('button');
        toggleButton.textContent = 'Show Logs';
        toggleButton.style.cssText = `
            position: fixed;
            bottom: 10px;
            right: 10px;
            z-index: 10000;
            padding: 5px 10px;
            background-color: #333;
            color: white;
            border: none;
            border-radius: 3px;
            cursor: pointer;
            font-size: 12px;
        `;
        
        toggleButton.addEventListener('click', () => {
            const isVisible = logContainer.style.display === 'block';
            logContainer.style.display = isVisible ? 'none' : 'block';
            toggleButton.textContent = isVisible ? 'Show Logs' : 'Hide Logs';
        });
        
        // Add to body
        document.body.appendChild(logContainer);
        document.body.appendChild(toggleButton);
    }
    
    // Log a message
    log(level, message, data = null) {
        // Check if this level should be logged
        if (this.logLevels[level] < this.logLevels[this.options.logLevel]) {
            return;
        }
        
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level,
            message,
            data
        };
        
        // Add to internal log array
        this.logs.push(logEntry);
        
        // Trim logs if needed
        if (this.logs.length > this.options.maxLogEntries) {
            this.logs.shift();
        }
        
        // Log to console if enabled
        if (this.options.enableConsole) {
            const consoleMethod = {
                debug: 'debug',
                info: 'info',
                warn: 'warn',
                error: 'error'
            }[level] || 'log';
            
            if (data) {
                console[consoleMethod](`[${timestamp}] [${level.toUpperCase()}] ${message}`, data);
            } else {
                console[consoleMethod](`[${timestamp}] [${level.toUpperCase()}] ${message}`);
            }
        }
        
        // Update UI log if enabled
        if (this.options.enableUI) {
            this.updateLogUI(logEntry);
        }
    }
    
    // Update the log UI
    updateLogUI(logEntry) {
        const logContent = document.getElementById('log-content');
        if (!logContent) return;
        
        const logElement = document.createElement('div');
        logElement.className = `log-entry log-${logEntry.level}`;
        
        const timestamp = logEntry.timestamp.substring(11, 19); // Just show the time part
        
        logElement.innerHTML = `
            <span class="log-time">${timestamp}</span>
            <span class="log-level ${logEntry.level}">${logEntry.level.toUpperCase()}</span>
            <span class="log-message">${this.escapeHTML(logEntry.message)}</span>
        `;
        
        logElement.style.cssText = `
            margin-bottom: 3px;
            border-left: 3px solid ${this.getLevelColor(logEntry.level)};
            padding-left: 5px;
        `;
        
        logContent.appendChild(logElement);
        logContent.scrollTop = logContent.scrollHeight;
    }
    
    // Get color for log level
    getLevelColor(level) {
        switch (level) {
            case 'debug': return '#aaa';
            case 'info': return '#58a6ff';
            case 'warn': return '#d29922';
            case 'error': return '#f85149';
            default: return '#ffffff';
        }
    }
    
    // Escape HTML
    escapeHTML(str) {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
    
    // Convenience methods for each log level
    debug(message, data = null) {
        this.log('debug', message, data);
    }
    
    info(message, data = null) {
        this.log('info', message, data);
    }
    
    warn(message, data = null) {
        this.log('warn', message, data);
    }
    
    error(message, data = null) {
        this.log('error', message, data);
    }
    
    // Get all logs
    getLogs() {
        return this.logs;
    }
    
    // Clear logs
    clearLogs() {
        this.logs = [];
        
        // Clear UI logs if enabled
        if (this.options.enableUI) {
            const logContent = document.getElementById('log-content');
            if (logContent) {
                logContent.innerHTML = '';
            }
        }
    }
    
    // Monitor for WebAssembly build errors
    monitorBuildErrors() {
        // Watch for WASM loading errors
        window.addEventListener('error', (e) => {
            // Check if it's a script error for the WASM file
            if (e.filename && e.filename.includes('llama-wasm.js')) {
                this.error(`WebAssembly load error: ${e.message}`);
                
                // Add a build error UI message if possible
                const container = document.getElementById('log-container');
                if (container) {
                    const buildError = document.createElement('div');
                    buildError.className = 'build-error';
                    buildError.innerHTML = `
                        <h3>WebAssembly Build Error</h3>
                        <p>The WebAssembly files failed to load properly. This might be due to:</p>
                        <ul>
                            <li>Failed build process</li>
                            <li>Missing dependencies (libcurl-dev)</li>
                            <li>Emscripten configuration issues</li>
                        </ul>
                        <p>The application will run in demo mode. To fix this:</p>
                        <ol>
                            <li>Install dependencies: <code>sudo apt-get install libcurl4-openssl-dev</code></li>
                            <li>Run Emscripten setup: <code>./setup-emscripten.sh</code></li>
                            <li>Source the environment: <code>source ./source-emscripten.sh</code></li>
                            <li>Try the simplified build: <code>./build-wasm-simple.sh</code></li>
                        </ol>
                    `;
                    buildError.style.cssText = `
                        background-color: #ffdddd;
                        border-left: 4px solid #f44336;
                        padding: 12px;
                        margin: 10px 0;
                        color: #333;
                        border-radius: 4px;
                    `;
                    container.appendChild(buildError);
                    container.style.display = 'block';
                }
            }
        });
        
        // Also hook into wasm module initialization
        window.addEventListener('DOMContentLoaded', () => {
            // Wait for potential WASM errors
            setTimeout(() => {
                const wasmSuccess = window.llamaModel && !window.llamaModel.isDemoMode;
                if (!wasmSuccess) {
                    this.warn('Running in demo mode - WebAssembly not properly loaded');
                }
            }, 3000);
        });
    }
    
    // Add capability to report build errors
    reportBuildError(error, buildCommand) {
        this.error(`Build error: ${error}`);
        this.error(`Failed command: ${buildCommand}`);
        
        // Add to UI if available
        const container = document.getElementById('log-container');
        if (container) {
            const buildError = document.createElement('div');
            buildError.className = 'build-error';
            buildError.innerHTML = `
                <h3>Build Error</h3>
                <p><strong>Error:</strong> ${this.escapeHTML(error)}</p>
                <p><strong>Command:</strong> ${this.escapeHTML(buildCommand)}</p>
                <p>Common solutions:</p>
                <ol>
                    <li>Install dependencies: <code>./install-dependencies.sh</code></li>
                    <li>Source Emscripten: <code>source ./source-emscripten.sh</code></li>
                    <li>Try simple build: <code>./build-wasm-simple.sh</code></li>
                </ol>
                <p>Error details:</p>
                <pre>${this.escapeHTML(error)}</pre>
            `;
            buildError.style.cssText = `
                background-color: #ffdddd;
                border-left: 4px solid #f44336;
                padding: 12px;
                margin: 10px 0;
                color: #333;
                border-radius: 4px;
                max-height: 300px;
                overflow-y: auto;
            `;
            container.appendChild(buildError);
            container.style.display = 'block';
        }
    }
}

// Create global logger instance
window.logger = new Logger({
    logLevel: 'debug',
    enableConsole: true,
    enableUI: true,
    enableBuildErrors: true
});
