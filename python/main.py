#!/usr/bin/env python3
"""
Unified Chess Analysis API Server
This is the main entry point for the chess analysis API.
Uses the new unified API system for all analysis operations.
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Import the unified API system
from core.unified_api_server import app

if __name__ == "__main__":
    import uvicorn
    import argparse
    
    parser = argparse.ArgumentParser(description="Unified Chess Analysis API Server")
    parser.add_argument("--host", default="0.0.0.0", help="Host to bind to")
    parser.add_argument("--port", type=int, default=8002, help="Port to bind to")
    parser.add_argument("--reload", action="store_true", help="Enable auto-reload")
    
    args = parser.parse_args()
    
    print(f"Starting Unified Chess Analysis API Server v3.0 on {args.host}:{args.port}")
    print("This server provides a single, comprehensive API for all chess analysis operations!")
    print("Available analysis types: basic, stockfish, deep")
    print("Unified endpoints:")
    print("  - POST /api/v1/analyze (handles all analysis types)")
    print("  - GET /api/v1/results/{user_id}/{platform}")
    print("  - GET /api/v1/stats/{user_id}/{platform}")
    print("  - GET /api/v1/progress/{user_id}/{platform}")
    print("  - GET /api/v1/deep-analysis/{user_id}/{platform}")
    
    uvicorn.run(app, host=args.host, port=args.port, reload=args.reload)

