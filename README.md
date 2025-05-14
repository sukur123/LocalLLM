# Browser-based Offline LLM Chatbot

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Platform](https://img.shields.io/badge/platform-Web-brightgreen.svg)

This project implements a completely offline chatbot that runs a local LLM directly in your browser using WebAssembly. The model runs entirely client-side without any server processing or internet access after initial loading, ensuring complete privacy.

## 🚀 Features

- **100% Client-side Processing**: All inference happens locally in the browser
- **Privacy-focused**: No data leaves your device
- **Offline Operation**: Works without internet once loaded
- **Multiple Model Support**: Compatible with GGUF format models (Llama 2, Mistral, Phi-2, etc.)
- **Interactive UI**: Clean chat interface with streaming responses
- **Memory Usage Monitoring**: Track resource consumption
- **Demo Mode**: Test UI functionality without building WebAssembly files

![Screenshot](https://user-images.githubusercontent.com/your-image-path.png)

## 🖥️ Demo

Try it online at: [https://sukur123.github.io/localLLMWeb](https://sukur123.github.io/localLLMWeb) (demo mode)

## 📋 Prerequisites

- Modern web browser (Chrome/Edge recommended for best performance)
- For building:
  - Linux/macOS environment
  - Emscripten SDK
  - CMake (3.14+)
  - libcurl development files (for some build options)

## 🔧 Quick Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-github-username/localLLMWeb.git
   cd localLLMWeb
   ```

2. **Download a model file**:
   ```bash
   ./download-models.sh
   ```

3. **Setup Emscripten** (one-time setup):
   ```bash
   ./setup-emscripten.sh
   source ./source-emscripten.sh
   ```

4. **Build the WebAssembly files**:
   ```bash
   # Option 1: Simple build without curl dependency (recommended)
   ./build-wasm-nocurl.sh
   
   # Option 2: Build with advanced features
   ./build-wasm-simple.sh
   ```

5. **Start the server**:
   ```bash
   ./start-server.sh
   ```

6. **Open in browser**:
   Visit the URL displayed by the server (typically `http://localhost:8080`)

## 🔍 Troubleshooting

If you encounter build errors:

1. **Run the diagnostic tool**:
   ```bash
   ./diagnostic.sh
   ```

2. **Install dependencies**:
   ```bash
   ./install-dependencies.sh
   ```

3. **Common issues**:
   - **libcurl not found**: `sudo apt-get install libcurl4-openssl-dev`
   - **Emscripten not in PATH**: `source ./source-emscripten.sh`
   - **Build fails**: Try the no-curl build with `./build-wasm-nocurl.sh`

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for detailed assistance.

## 📱 Browser Compatibility

| Browser | Support | Notes |
|---------|---------|-------|
| Chrome/Edge | ✅ Excellent | Best performance and highest memory limits |
| Firefox | ✅ Good | Slightly lower memory limits than Chrome |
| Safari | ⚠️ Limited | More restrictive memory limits, works with smaller models |
| Mobile browsers | ⚠️ Limited | Works with tiny models (≤1B parameters) |

## 🧠 Recommended Models

For optimal performance, use smaller instruction-tuned models with high quantization:

| Model | Size | Type | Performance |
|-------|------|------|-------------|
| SmolLM2-135M-Instruct | 85MB | Q2_K | Ultra-lightweight, fast |
| TinyLlama-1.1B-Chat | ~600MB | Q4_K | Good balance of size/quality |
| Phi-2 | ~1.2GB | Q4_K | Excellent quality for size |
| Mistral-7B-Instruct | ~4GB | Q4_K | Better quality, requires powerful device |

## 🛠️ Advanced Usage

### Demo Mode

The application includes a "demo mode" that activates when:
- WebAssembly files aren't available
- No model file is found
- `?demo=true` is added to the URL

This allows testing the UI without compiling WebAssembly or downloading models.

### Memory Requirements

- Small models (1-2B parameters): 1-2GB RAM
- Medium models (7B parameters): 4-8GB RAM

### How It Works

1. The llama.cpp library is compiled to WebAssembly using Emscripten
2. The WASM module loads the GGUF model file into memory
3. User input is processed into the appropriate prompt format
4. The model generates tokens that are streamed back to the UI
5. The chat history maintains context for the conversation

## 📁 Project Structure

```
localLLMWeb/
├── css/                       # Styling
├── js/                        # Application logic
│   ├── chat.js                # Chat management
│   ├── log.js                 # Logging utilities
│   └── ui.js                  # UI interactions
├── models/                    # GGUF model storage
├── wasm/                      # WebAssembly files
├── build-wasm-nocurl.sh       # Build script without curl dependency
├── build-wasm-simple.sh       # Simplified build script
├── build-wasm.sh              # Original build script
├── diagnostic.sh              # Environment diagnostics
├── download-models.sh         # Model downloader
├── install-dependencies.sh    # Dependency installer
├── setup-emscripten.sh        # Emscripten setup
├── source-emscripten.sh       # Environment sourcing
├── start-server.sh            # Local web server
└── TROUBLESHOOTING.md         # Detailed troubleshooting
```

## 🧩 Customization

- Edit the system prompt in `chat.js` to change the model's behavior
- Adjust generation parameters in `chat.js` for different response styles
- Modify the UI in `styles.css` to customize the appearance

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [llama.cpp](https://github.com/ggerganov/llama.cpp) for the core inference engine
- [Emscripten](https://emscripten.org/) for WebAssembly compilation
- [GGUF model creators](https://huggingface.co/models?sort=trending&search=gguf) for providing open models

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request
