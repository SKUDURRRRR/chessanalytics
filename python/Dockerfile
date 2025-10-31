FROM python:3.11-slim

# Install system dependencies including Stockfish
RUN apt-get update && \
    apt-get install -y stockfish && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Find where Stockfish is actually installed
RUN ls -la /usr/games/stockfish /usr/bin/stockfish /usr/local/bin/stockfish 2>/dev/null || true
RUN /usr/games/stockfish --version || /usr/bin/stockfish --version || /usr/local/bin/stockfish --version || echo "Stockfish not found in common locations"

# Set working directory
WORKDIR /app

# Copy requirements and install Python dependencies
# requirements.txt is now in the python/ directory
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Detect and set Stockfish path at build time
RUN if [ -f /usr/games/stockfish ]; then \
        echo "Found Stockfish at: /usr/games/stockfish"; \
        echo "/usr/games/stockfish" > /tmp/stockfish_path; \
    elif [ -f /usr/bin/stockfish ]; then \
        echo "Found Stockfish at: /usr/bin/stockfish"; \
        echo "/usr/bin/stockfish" > /tmp/stockfish_path; \
    elif [ -f /usr/local/bin/stockfish ]; then \
        echo "Found Stockfish at: /usr/local/bin/stockfish"; \
        echo "/usr/local/bin/stockfish" > /tmp/stockfish_path; \
    else \
        echo "Using stockfish from PATH"; \
        echo "stockfish" > /tmp/stockfish_path; \
    fi

# Set environment variables
ENV PYTHONPATH=/app
# Set STOCKFISH_PATH - Railway/Debian default location
ENV STOCKFISH_PATH=/usr/games/stockfish

# Expose port
EXPOSE 8000

# Start the application
CMD ["sh", "-c", "echo 'STOCKFISH_PATH='$STOCKFISH_PATH && echo 'PORT='$PORT && uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
