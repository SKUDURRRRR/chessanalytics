#!/usr/bin/env python3
"""
Diagnostic script to identify AI comment generation issues.
Run this to check your AI setup and identify why comments are generic.
"""

import sys
import os
from pathlib import Path

# Add python directory to path
sys.path.insert(0, str(Path(__file__).parent))

print("=" * 60)
print("AI COMMENT GENERATION DIAGNOSTIC TOOL")
print("=" * 60)
print()

# Check environment variables
print("1. CHECKING ENVIRONMENT VARIABLES")
print("-" * 60)
api_key = os.getenv("ANTHROPIC_API_KEY") or os.getenv("AI_ANTHROPIC_API_KEY")
ai_enabled = os.getenv("AI_ENABLED", "false").lower()
ai_model = os.getenv("AI_MODEL", "not set")

print(f"ANTHROPIC_API_KEY: {'✅ Found' if api_key else '❌ NOT FOUND'}")
if api_key:
    print(f"   Key preview: {api_key[:15]}...{api_key[-4:]}")
    print(f"   Key length: {len(api_key)} characters")
else:
    print("   ⚠️  Check your .env.local files:")
    print("      - python/.env.local")
    print("      - .env.local (root)")

print(f"AI_ENABLED: {ai_enabled}")
if ai_enabled not in ['true', '1', 'yes']:
    print("   ⚠️  AI is DISABLED! Set AI_ENABLED=true in .env.local")

print(f"AI_MODEL: {ai_model}")
if ai_model == "claude-3-5-sonnet-20241022":
    print("   ⚠️  Using old model name! Update to: claude-3-5-sonnet-20240620")
elif ai_model == "not set":
    print("   ⚠️  Using default from code")
else:
    print(f"   Current model: {ai_model}")

print()

# Check .env.local files
print("2. CHECKING .env.local FILES")
print("-" * 60)
base_dir = Path(__file__).parent
root_dir = base_dir.parent

env_files = [
    (base_dir / '.env.local', 'python/.env.local'),
    (base_dir / '.env', 'python/.env'),
    (root_dir / '.env.local', '.env.local (root)'),
    (root_dir / '.env', '.env (root)'),
]

for env_path, label in env_files:
    if env_path.exists():
        print(f"✅ {label} exists")
        # Check if it contains our variables
        content = env_path.read_text()
        has_key = 'ANTHROPIC_API_KEY' in content or 'AI_ANTHROPIC_API_KEY' in content
        has_enabled = 'AI_ENABLED' in content
        has_model = 'AI_MODEL' in content

        if has_key:
            print(f"   ✅ Contains ANTHROPIC_API_KEY")
        if has_enabled:
            print(f"   ✅ Contains AI_ENABLED")
        if has_model:
            print(f"   ✅ Contains AI_MODEL")
            # Check the actual value
            for line in content.split('\n'):
                if line.startswith('AI_MODEL='):
                    model_value = line.split('=', 1)[1].strip()
                    print(f"   📝 Model value: {model_value}")
                    if '20241022' in model_value:
                        print(f"      ⚠️  WARNING: Old model name! This may cause 404 errors.")
                        print(f"      💡 Update to: claude-3-5-sonnet-20240620")
    else:
        print(f"❌ {label} does not exist")

print()

# Try to initialize AI generator
print("3. TESTING AI GENERATOR INITIALIZATION")
print("-" * 60)
try:
    from core.ai_comment_generator import AIChessCommentGenerator
    generator = AIChessCommentGenerator()

    print(f"Generator created: {'✅' if generator else '❌'}")
    if generator:
        print(f"AI Enabled: {'✅' if generator.enabled else '❌'}")
        print(f"Model: {generator.config.ai_model}")
        print(f"API Key in config: {'✅' if generator.config.anthropic_api_key else '❌'}")
        print(f"Client initialized: {'✅' if generator.client else '❌'}")

        if generator.enabled and generator.client:
            print()
            print("4. TESTING API CALL")
            print("-" * 60)
            # Try a simple test call
            try:
                # This is a minimal test - just check if we can make a call
                print("Attempting test API call...")
                # We'll use a very simple prompt
                test_response = generator.client.messages.create(
                    model=generator.config.ai_model,
                    max_tokens=50,
                    system="You are a helpful assistant.",
                    messages=[{"role": "user", "content": "Say 'test' if you can read this."}]
                )
                if test_response.content:
                    print("✅ API call successful! Model is working.")
                    print(f"   Response: {test_response.content[0].text[:50]}")
                else:
                    print("⚠️  API call succeeded but no content returned")
            except Exception as e:
                error_str = str(e)
                if "404" in error_str or "not_found" in error_str.lower():
                    print(f"❌ Model not found (404): {generator.config.ai_model}")
                    print("   💡 Try these model names:")
                    print("      - claude-3-5-sonnet-20240620")
                    print("      - claude-3-sonnet-20240229")
                    print("      - claude-3-opus-20240229")
                else:
                    print(f"❌ API call failed: {e}")
        else:
            print("⚠️  Cannot test API - generator not properly initialized")
            if not generator.enabled:
                print("   💡 Check: AI_ENABLED=true in .env.local")
            if not generator.client:
                print("   💡 Check: ANTHROPIC_API_KEY in .env.local")

except Exception as e:
    print(f"❌ Error initializing generator: {e}")
    import traceback
    traceback.print_exc()

print()
print("=" * 60)
print("DIAGNOSTIC COMPLETE")
print("=" * 60)
print()
print("NEXT STEPS:")
print("1. If AI_MODEL is wrong, update it in your .env.local file")
print("2. If API key is missing, add ANTHROPIC_API_KEY to .env.local")
print("3. If AI_ENABLED is false, set AI_ENABLED=true in .env.local")
print("4. Restart your backend server after making changes")
print()
