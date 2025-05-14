#!/bin/bash

# Use Python's built-in HTTP server instead
echo "Starting local web server using Python..."

# Function to check if a port is available
check_port() {
    (echo > /dev/tcp/127.0.0.1/$1) 2>/dev/null
    if [ $? -eq 0 ]; then
        # Port is in use
        return 1
    else
        # Port is available
        return 0
    fi
}

# Find an available port starting from 8080
PORT=8080
while ! check_port $PORT && [ $PORT -lt 8100 ]; do
    PORT=$((PORT + 1))
    echo "Port $((PORT - 1)) is in use, trying port $PORT"
done

if [ $PORT -ge 8100 ]; then
    echo "Error: Could not find an available port in range 8080-8099"
    exit 1
fi

echo "Using port $PORT"

# Change to the script's directory
cd "$(dirname "$0")"

# Check which Python version is available
if command -v python3 &> /dev/null
then
    echo "Using Python 3..."
    python3 -m http.server $PORT
elif command -v python &> /dev/null
then
    echo "Using Python..."
    python -m SimpleHTTPServer $PORT
else
    echo "Error: Neither python nor python3 is installed!"
    exit 1
fi
else
    echo "Error: Neither python nor python3 is installed!"
    exit 1
fi
