# Models Directory

Place your GGUF format model files in this directory.

## Recommended Models

For optimal performance in a browser environment, consider using these models:

1. Small models (recommended for most browsers):
   - [TinyLlama-1.1B-Chat-v1.0](https://huggingface.co/TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF)
   - [SmolLM-1B-GGUF](https://huggingface.co/LadAlchemist/SmolLM-1B-GGUF)
   - [Phi-2](https://huggingface.co/TheBloke/phi-2-GGUF)

2. Medium models (for more powerful devices):
   - [Mistral-7B-Instruct-v0.2](https://huggingface.co/TheBloke/Mistral-7B-Instruct-v0.2-GGUF) (Q2_K or Q3_K quantization)
   - [Phi-3-Mini-4K-Instruct](https://huggingface.co/TheBloke/phi-3-mini-4k-instruct-GGUF)

## Quantization

In browser environments, highly quantized models work best due to memory constraints:
- Q2_K: Smallest size, lowest quality
- Q4_K: Good balance of size and quality
- Q6_K: Better quality, larger size

## Setup

1. Download a GGUF model from Hugging Face
2. Place it in this directory 
3. Update the model filename in `/js/chat.js` (look for loadModel function)

Example model filenames:
- TinyLlama-1.1B-Chat-v1.0.Q4_K.gguf
- Phi-3-mini-4k-instruct.Q2_K.gguf
- Mistral-7B-Instruct-v0.2.Q3_K.gguf
