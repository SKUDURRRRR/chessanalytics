#!/bin/bash
set -euo pipefail

echo "Starting build process..."

# Install Python dependencies
echo "Installing Python dependencies..."
pip install -r requirements.txt

# Note: Using Python stockfish package instead of system binary
echo "Using Python stockfish package (no system installation needed)"

echo "Build process completed successfully!"
