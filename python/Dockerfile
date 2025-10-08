FROM python:3.11-slim

# Install system dependencies including Stockfish
RUN apt-get update && \
    apt-get install -y stockfish && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Find where Stockfish is actually installed
RUN which stockfish && stockfish --version

# Set working directory
WORKDIR /app

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Find the actual Stockfish path and set it
RUN STOCKFISH_PATH=$(which stockfish) && echo "Found Stockfish at: $STOCKFISH_PATH" && echo "STOCKFISH_PATH=$STOCKFISH_PATH" >> /etc/environment

# Set environment variables
ENV PYTHONPATH=/app

# Expose port
EXPOSE 8000

# Start the application
CMD ["sh", "-c", "echo 'STOCKFISH_PATH='$STOCKFISH_PATH && echo 'PORT='$PORT && uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
