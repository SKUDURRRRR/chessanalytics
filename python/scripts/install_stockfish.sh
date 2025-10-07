#!/usr/bin/env bash
set -euo pipefail

STOCKFISH_DIR="/opt/stockfish"
STOCKFISH_BINARY="$STOCKFISH_DIR/stockfish"

mkdir -p "$STOCKFISH_DIR"

if [ ! -x "$STOCKFISH_BINARY" ]; then
  echo "Downloading Stockfish binary..."
  curl -sSL https://stockfishchess.org/files/stockfish-15.1-linux.zip -o /tmp/stockfish.zip
  echo "Extracting Stockfish..."
  mkdir -p /tmp/stockfish_extract
  unzip -q -o /tmp/stockfish.zip -d /tmp/stockfish_extract
  STOCKFISH_SOURCE=$(find /tmp/stockfish_extract -type f -name "stockfish*" | head -n 1)
  if [ -z "$STOCKFISH_SOURCE" ]; then
    echo "Stockfish binary not found in archive"
    exit 1
  fi
  cp "$STOCKFISH_SOURCE" "$STOCKFISH_BINARY"
  chmod +x "$STOCKFISH_BINARY"
else
  echo "Stockfish already installed at $STOCKFISH_BINARY"
fi

ls -al "$STOCKFISH_DIR"
echo "Stockfish installed at $STOCKFISH_BINARY"
