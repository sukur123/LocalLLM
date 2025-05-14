# Build Error Troubleshooting Guide

You're encountering build errors related to missing `libcurl` development files when trying to compile llama.cpp for WebAssembly. Here's how to fix it:

## Error Explanation

The error is:
```
CMake Error at common/CMakeLists.txt:92 (message):
  Could NOT find CURL.  Hint: to disable this feature, set -DLLAMA_CURL=OFF
```

This means:
- The build process is trying to find libcurl development files
- These files are missing on your system
- Although the build script includes `-DLLAMA_CURL=OFF`, there might be an issue with how it's applied

## Solution Steps

1. **Install libcurl development package**:
   ```bash
   sudo apt-get install libcurl4-openssl-dev
   ```

2. **Use the diagnostic script** to verify your environment:
   ```bash
   ./diagnostic.sh
   ```

3. **Install all dependencies** with the new helper script:
   ```bash
   ./install-dependencies.sh
   ```

4. **Source the Emscripten environment** (this is required each time you build):
   ```bash
   source ./source-emscripten.sh
   ```

5. **Try the simplified build script** that better handles the CURL dependency:
   ```bash
   ./build-wasm-simple.sh
   ```

## Improvements Made

I've added several tools to help with the WebAssembly build process:

1. `diagnostic.sh` - Checks your build environment and identifies issues
2. `install-dependencies.sh` - Installs all required dependencies
3. Enhanced error reporting in the application
4. Improved `build-wasm-simple.sh` script
5. Updated documentation with troubleshooting steps

## Using Demo Mode

If you're still encountering build issues, you can always use the application in demo mode:

1. Start the server: `./start-server.sh`
2. Access the app: `http://localhost:8080?demo=true`

This will let you test the UI functionality without requiring the WebAssembly build.

## Next Steps

1. Run `./install-dependencies.sh` to install the required dependencies
2. Run `source ./source-emscripten.sh` to set up the environment
3. Run `./build-wasm-simple.sh` to build the WebAssembly files
4. Check the build status with `./diagnostic.sh`
5. Start the server with `./start-server.sh` when the build is successful
