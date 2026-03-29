#!/usr/bin/env python3
"""
Quick test script to verify AI comment generator setup.
Run this to check if your ANTHROPIC_API_KEY is being loaded correctly.
"""

import sys
from pathlib import Path

# Add python directory to path
sys.path.insert(0, str(Path(__file__).parent))

from core.ai_comment_generator import AIChessCommentGenerator

def test_ai_setup():
    """Test if AI comment generator is properly configured."""
    print("Testing AI Comment Generator Setup...")
    print("=" * 50)

    # Check environment variables
    import os
    api_key = os.getenv("ANTHROPIC_API_KEY") or os.getenv("AI_ANTHROPIC_API_KEY")

    if api_key:
        print(f"✅ API Key found: {api_key[:10]}...{api_key[-4:]}")
    else:
        print("❌ API Key NOT found!")
        print("\nPlease check:")
        print("1. Is ANTHROPIC_API_KEY in your .env.local file?")
        print("2. Is the file in the correct location (python/.env.local or root .env.local)?")
        print("3. Is the variable name correct? (should be ANTHROPIC_API_KEY)")
        return False

    # Try to initialize the generator
    try:
        generator = AIChessCommentGenerator()
        if generator.enabled:
            print(f"✅ AI Generator initialized successfully!")
            print(f"   Model: {generator.config.ai_model}")
            print(f"   Enabled: {generator.enabled}")
            return True
        else:
            print("⚠️  AI Generator created but not enabled")
            print("   Check AI_ENABLED setting (should be 'true')")
            return False
    except Exception as e:
        print(f"❌ Error initializing AI Generator: {e}")
        return False

if __name__ == "__main__":
    success = test_ai_setup()
    sys.exit(0 if success else 1)
