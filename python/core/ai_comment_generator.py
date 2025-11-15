"""
AI-Powered Chess Comment Generator using Claude (Anthropic)

This module uses Anthropic's Claude models to generate human-like,
educational chess comments tailored for players rated 600-1800 ELO.

Features:
- Automatic model fallback: Tries known working models first, then falls back
  to configured or optional models if the primary model fails
- Supports multiple Claude models:
  - claude-3-haiku-20240307 (recommended: fastest, cheapest, most reliable)
  - claude-3-sonnet-20240229 (good balance of quality and cost)
  - claude-3-5-sonnet-20240620 (best quality, may not be available to all API keys)
  - claude-3-5-sonnet (latest version, best quality)
- Graceful error handling with clear logging for debugging
"""

import os
import re
import hashlib
import time
import threading
import asyncio
from pathlib import Path
from typing import Dict, Any, Optional
from enum import Enum
import chess
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

# Try to import Anthropic, but make it optional
try:
    from anthropic import Anthropic
    ANTHROPIC_AVAILABLE = True
except ImportError:
    ANTHROPIC_AVAILABLE = False
    Anthropic = None  # type: ignore

# Load environment variables from .env.local files
BASE_DIR = Path(__file__).resolve().parent.parent
# Load from python/.env.local first (highest priority)
load_dotenv(BASE_DIR / '.env.local', override=True)
# Then python/.env
load_dotenv(BASE_DIR / '.env', override=False)
# Then root .env.local
load_dotenv(BASE_DIR.parent / '.env.local', override=False)
# Finally root .env (lowest priority)
load_dotenv(BASE_DIR.parent / '.env', override=False)


class AIConfig(BaseSettings):
    """Configuration for AI comment generation.

    Model options:
    - claude-3-haiku-20240307 (recommended: fastest, cheapest, most reliable)
    - claude-3-sonnet-20240229 (good balance of quality and cost)
    - claude-3-5-sonnet-20240620 (best quality, may not be available to all API keys)
    - claude-3-5-sonnet (latest version, best quality)

    The system will automatically fall back to working models if the configured
    model is not available.
    """
    anthropic_api_key: Optional[str] = None
    ai_enabled: bool = True
    ai_model: str = "claude-3-haiku-20240307"  # Recommended: most reliable, fastest, cheapest
    max_tokens: int = 150  # Optimized: 2-3 sentences max (reduced from 200 to save costs)
    temperature: float = 0.75  # Slightly reduced from 0.85 to reduce variability and token usage
    api_timeout: float = 30.0  # API call timeout in seconds (reduced from 60s to 30s to prevent blocking)
    rate_limit_delay: float = 2.0  # Delay between AI API calls in seconds (increased to prevent 429 errors)

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # Manual override: Check for AI_MODEL (without double prefix) as fallback
        # Pydantic with env_prefix="AI_" looks for AI_AI_MODEL, but we also support AI_MODEL
        # Always check AI_MODEL directly from environment (common in .env.local files)
        direct_model = os.getenv("AI_MODEL")
        if direct_model:
            self.ai_model = direct_model
            print(f"[AI] Using AI_MODEL from environment: {direct_model}")

    class Config:
        env_prefix = "AI_"
        case_sensitive = False
        extra = "ignore"


class MoveQuality(Enum):
    """Move quality classifications."""
    BRILLIANT = "brilliant"
    BEST = "best"
    EXCELLENT = "excellent"
    GOOD = "good"
    INACCURACY = "inaccuracy"
    MISTAKE = "mistake"
    BLUNDER = "blunder"


class AIChessCommentGenerator:
    """
    Generates human-like chess comments using Claude (Anthropic) models.

    Features automatic model fallback - if the configured model is unavailable,
    it will automatically try working alternatives in order of reliability.

    Designed for players rated 600-1800 ELO, providing:
    - Clear, simple explanations
    - Educational context
    - Encouraging tone (inspired by Mikhail Tal's playful style)
    - No technical jargon without explanation

    The comment generation uses a Tal-inspired system prompt that makes
    chess feel alive and emotional, focusing on principles and ideas rather
    than just evaluation numbers.
    """

    def __init__(self):
        print("[AI] Initializing AIChessCommentGenerator...")
        self.config = AIConfig()
        print(f"[AI] Config loaded - Model: {self.config.ai_model}, Enabled: {self.config.ai_enabled}")
        print(f"[AI] API Key present: {bool(self.config.anthropic_api_key)}")
        self.client = None
        self.enabled = False

        # Rate limiting: track last API call time to prevent overwhelming the API
        self._last_api_call_time = 0.0
        self._rate_limit_lock = threading.Lock()
        self._rate_limit_delay = self.config.rate_limit_delay

        # Async rate limiting: token bucket rate limiter for parallel calls
        # Anthropic limit: 50 requests per minute
        try:
            from .resilient_api_client import RateLimiter
            self._async_rate_limiter = RateLimiter(
                capacity=50,  # Anthropic limit: 50 requests/minute
                refill_rate=50.0 / 60.0  # Refill at 50/60 requests per second
            )
            # Semaphore to limit concurrent API calls (prevent overwhelming)
            self._api_semaphore = asyncio.Semaphore(15)  # Max 15 concurrent calls
            print("[AI] ✅ Async rate limiter initialized (50 req/min, 15 concurrent)")
        except ImportError:
            self._async_rate_limiter = None
            self._api_semaphore = None
            print("[AI] ⚠️  RateLimiter not available, async parallel calls disabled")

        # Initialize comment cache to avoid regenerating identical comments
        # Cache key: hash of (FEN + move + quality + ELO_range)
        # Cache size: 500 entries (common positions/moves)
        # TTL: 24 hours (comments don't change for same position)
        try:
            from .cache_manager import LRUCache
            self._comment_cache = LRUCache(maxsize=500, ttl=86400, name="ai_comment_cache")
            print("[AI] ✅ Comment cache initialized (500 entries, 24h TTL)")
        except ImportError:
            # Fallback to simple dict if cache_manager not available
            self._comment_cache = {}
            print("[AI] ⚠️  Cache manager not available, using simple dict cache")

        # Check if Anthropic package is available
        if not ANTHROPIC_AVAILABLE:
            print("[AI] ❌ Warning: Anthropic package not installed. AI comments will be disabled.")
            print("[AI] Install with: pip install anthropic>=0.18.0")
            return

        print("[AI] ✅ Anthropic package is available")

        # Initialize Anthropic client if API key is available
        api_key = None
        if self.config.anthropic_api_key:
            api_key = self.config.anthropic_api_key
            print("[AI] Found API key in config.anthropic_api_key")
        else:
            # Try to get from environment variable directly
            api_key = os.getenv("ANTHROPIC_API_KEY") or os.getenv("AI_ANTHROPIC_API_KEY")
            if api_key:
                print("[AI] Found API key in environment variable")
            else:
                print("[AI] ⚠️  No API key found in config or environment variables")

        if api_key:
            try:
                # Mask API key for logging (show first 10 and last 4 chars)
                masked_key = f"{api_key[:10]}...{api_key[-4:]}" if len(api_key) > 14 else "***"
                print(f"[AI] Attempting to initialize Anthropic client with key: {masked_key}")
                print(f"[AI] Model from config: {self.config.ai_model}")
                print(f"[AI] AI_ENABLED from config: {self.config.ai_enabled}")
                print(f"[AI] API timeout: {self.config.api_timeout}s")

                # Initialize Anthropic client with httpx timeout configuration
                # This prevents the SDK from hanging indefinitely on slow API responses
                # Reduced timeout to fail fast and prevent blocking analysis
                try:
                    import httpx
                    timeout = httpx.Timeout(
                        connect=10.0,  # Connection timeout: 10 seconds
                        read=self.config.api_timeout,  # Read timeout: configurable (default 30s, reduced from 60s)
                        write=10.0,  # Write timeout: 10 seconds
                        pool=10.0  # Pool timeout: 10 seconds
                    )
                    # Create httpx client with timeout configuration
                    http_client = httpx.Client(timeout=timeout)
                    # Pass the custom http_client to Anthropic SDK
                    # The SDK will use this client for all HTTP requests
                    # Set max_retries=0 to disable automatic retries on 429 errors
                    # We handle rate limits manually with delays to prevent blocking
                    try:
                        self.client = Anthropic(
                            api_key=api_key,
                            http_client=http_client,
                            max_retries=0  # Disable automatic retries - we handle rate limits manually
                        )
                    except TypeError:
                        # Older SDK versions might not support max_retries parameter
                        self.client = Anthropic(
                            api_key=api_key,
                            http_client=http_client
                        )
                    print(f"[AI] ✅ Anthropic client initialized with httpx timeout: {self.config.api_timeout}s, max_retries=0")
                except (ImportError, TypeError) as e:
                    # Fallback if httpx is not available or http_client parameter not supported
                    # (shouldn't happen with modern Anthropic SDK, but be defensive)
                    print(f"[AI] ⚠️  Could not configure custom http_client: {e}")
                    print(f"[AI] ⚠️  Using default client (timeout may not be configurable)")
                    try:
                        self.client = Anthropic(api_key=api_key, max_retries=0)
                    except TypeError:
                        # Older SDK versions might not support max_retries parameter
                        self.client = Anthropic(api_key=api_key)

                self.enabled = self.config.ai_enabled
                if self.enabled:
                    print(f"[AI] ✅ Anthropic client initialized successfully!")
                    print(f"[AI] ✅ Model: {self.config.ai_model}")
                    print(f"[AI] ✅ AI enabled: {self.enabled}")
                    # Test the model by trying to list available models (if possible) or just confirm setup
                    print(f"[AI] Ready to generate comments with model: {self.config.ai_model}")
                else:
                    print(f"[AI] ⚠️  Anthropic client initialized but AI is disabled (AI_ENABLED={self.config.ai_enabled})")
                    print(f"[AI] ⚠️  Set AI_ENABLED=true in your .env file to enable AI comments")
            except Exception as e:
                print(f"[AI] ❌ Warning: Failed to initialize Anthropic client: {e}")
                import traceback
                print(f"[AI] Traceback: {traceback.format_exc()}")
                self.enabled = False
        else:
            print("[AI] ⚠️  No API key available, AI comments will be disabled")
            print("[AI] ⚠️  Check your .env.local file for ANTHROPIC_API_KEY")

    def generate_comment(
        self,
        move_analysis: Dict[str, Any],
        board: chess.Board,
        move: chess.Move,
        is_user_move: bool = True,
        player_elo: int = 1200  # Default to middle of target range
    ) -> Optional[str]:
        """
        Generate an AI-powered comment for a chess move.

        Args:
            move_analysis: Dictionary containing move analysis data
            board: Chess board position after the move
            move: The chess move being analyzed
            is_user_move: Whether this is the user's move or opponent's
            player_elo: Estimated player ELO (for tailoring complexity)

        Returns:
            Generated comment string, or None if AI is disabled/failed
        """
        if not self.enabled:
            print("[AI] Generator is not enabled")
            return None

        if not self.client:
            print("[AI] Anthropic client is not initialized")
            return None

        try:
            # Check cache first to avoid regenerating identical comments
            cache_key = self._generate_cache_key(move_analysis, board, move, is_user_move, player_elo)
            if hasattr(self._comment_cache, 'get'):
                cached_comment = self._comment_cache.get(cache_key)
                if cached_comment:
                    print(f"[AI] ✅ Cache hit! Reusing comment for {move_analysis.get('move_san', 'unknown')}")
                    return cached_comment
            elif isinstance(self._comment_cache, dict) and cache_key in self._comment_cache:
                cached_comment = self._comment_cache[cache_key]
                print(f"[AI] ✅ Cache hit! Reusing comment for {move_analysis.get('move_san', 'unknown')}")
                return cached_comment

            print(f"[AI] Building prompt for move {move_analysis.get('move_san', 'unknown')}, ELO: {player_elo}")
            # Prepare prompt with move context
            prompt = self._build_prompt(move_analysis, board, move, is_user_move, player_elo)

            print(f"[AI] Calling Anthropic API with model {self.config.ai_model}")
            system_prompt = "You are Mikhail Tal, the Magician from Riga. You teach chess with energy and insight, explaining the principles behind each move. Your comments are engaging and instructive—you help players understand why moves work or fail. Focus on teaching chess concepts clearly: piece coordination, tactical patterns, positional understanding. Use occasional metaphors when they help explain, but prioritize clear analysis and principle-based teaching. You encourage creative thinking while building solid chess understanding. Never start comments with 'Ah,' 'Oh,' or similar interjections—begin directly with your commentary."

            # Use the helper method with fallback
            comment = self._call_api_with_fallback(
                prompt=prompt,
                system=system_prompt,
                max_tokens=self.config.max_tokens,
                temperature=self.config.temperature
            )

            if comment:
                # Get capture info for validation
                board_before = move_analysis.get('board_before')
                is_capture = False
                captured_piece_name = None
                if board_before and move:
                    captured_piece = board_before.piece_at(move.to_square)
                    if captured_piece:
                        is_capture = True
                        piece_names = {
                            chess.PAWN: "pawn",
                            chess.KNIGHT: "knight",
                            chess.BISHOP: "bishop",
                            chess.ROOK: "rook",
                            chess.QUEEN: "queen",
                            chess.KING: "king"
                        }
                        piece_name = piece_names.get(captured_piece.piece_type, "piece")
                        color = "white" if captured_piece.color == chess.WHITE else "black"
                        captured_piece_name = f"{color} {piece_name}"

                move_san = move_analysis.get('move_san', '')
                player_color = move_analysis.get('player_color', 'white')
                # Clean and validate comment
                comment = self._clean_comment(comment, is_user_move, player_color)
                comment = self._validate_comment(comment, move_san, is_capture, is_user_move, captured_piece_name)
                print(f"[AI] Generated comment ({len(comment)} chars): {comment[:100]}...")

                # Cache the comment for future use
                if hasattr(self._comment_cache, 'set'):
                    self._comment_cache.set(cache_key, comment)
                elif isinstance(self._comment_cache, dict):
                    self._comment_cache[cache_key] = comment

                return comment

            print("[AI] Response had no content")
            return None

        except Exception as e:
            import traceback
            print(f"[AI] Error generating AI comment: {e}")
            print(f"[AI] Full traceback: {traceback.format_exc()}")
            return None

    async def generate_comment_async(
        self,
        move_analysis: Dict[str, Any],
        board: chess.Board,
        move: chess.Move,
        is_user_move: bool = True,
        player_elo: int = 1200
    ) -> Optional[str]:
        """
        Async version of generate_comment for parallel execution.
        Respects Anthropic rate limits (50 requests/minute) using token bucket rate limiter.

        Args:
            move_analysis: Dictionary containing move analysis data
            board: Chess board position after the move
            move: The chess move being analyzed
            is_user_move: Whether this is the user's move or opponent's
            player_elo: Estimated player ELO (for tailoring complexity)

        Returns:
            Generated comment string, or None if AI is disabled/failed
        """
        if not self.enabled:
            return None

        if not self.client:
            return None

        # Check if async rate limiter is available
        if not self._async_rate_limiter or not self._api_semaphore:
            # Fallback to synchronous version if rate limiter not available
            print("[AI] Async rate limiter not available, falling back to sync")
            return self.generate_comment(move_analysis, board, move, is_user_move, player_elo)

        try:
            # Check cache first (same as sync version)
            cache_key = self._generate_cache_key(move_analysis, board, move, is_user_move, player_elo)
            if hasattr(self._comment_cache, 'get'):
                cached_comment = self._comment_cache.get(cache_key)
                if cached_comment:
                    print(f"[AI] ✅ Cache hit! Reusing comment for {move_analysis.get('move_san', 'unknown')}")
                    return cached_comment
            elif isinstance(self._comment_cache, dict) and cache_key in self._comment_cache:
                cached_comment = self._comment_cache[cache_key]
                print(f"[AI] ✅ Cache hit! Reusing comment for {move_analysis.get('move_san', 'unknown')}")
                return cached_comment

            # Wait for rate limiter token (respects 50/minute limit, non-blocking)
            token_acquired = await self._async_rate_limiter.wait_for_token(tokens=1, timeout=30.0)
            if not token_acquired:
                print(f"[AI] ⚠️  Rate limiter timeout for {move_analysis.get('move_san', 'unknown')}, skipping AI comment")
                return None

            # Use semaphore to limit concurrent calls
            async with self._api_semaphore:
                print(f"[AI] Building prompt for move {move_analysis.get('move_san', 'unknown')}, ELO: {player_elo}")
                prompt = self._build_prompt(move_analysis, board, move, is_user_move, player_elo)

                print(f"[AI] Calling Anthropic API (async) with model {self.config.ai_model}")
                system_prompt = "You are Mikhail Tal, the Magician from Riga. You teach chess with energy and insight, explaining the principles behind each move. Your comments are engaging and instructive—you help players understand why moves work or fail. Focus on teaching chess concepts clearly: piece coordination, tactical patterns, positional understanding. Use occasional metaphors when they help explain, but prioritize clear analysis and principle-based teaching. You encourage creative thinking while building solid chess understanding. Never start comments with 'Ah,' 'Oh,' or similar interjections—begin directly with your commentary."

                # Use async API call
                comment = await self._call_api_async(prompt, system_prompt)

                if comment:
                    # Get capture info for validation
                    board_before = move_analysis.get('board_before')
                    is_capture = False
                    captured_piece_name = None
                    if board_before and move:
                        captured_piece = board_before.piece_at(move.to_square)
                        if captured_piece:
                            is_capture = True
                            piece_names = {
                                chess.PAWN: "pawn",
                                chess.KNIGHT: "knight",
                                chess.BISHOP: "bishop",
                                chess.ROOK: "rook",
                                chess.QUEEN: "queen",
                                chess.KING: "king"
                            }
                            piece_name = piece_names.get(captured_piece.piece_type, "piece")
                            color = "white" if captured_piece.color == chess.WHITE else "black"
                            captured_piece_name = f"{color} {piece_name}"

                    move_san = move_analysis.get('move_san', '')
                    player_color = move_analysis.get('player_color', 'white')
                    # Clean and validate comment
                    comment = self._clean_comment(comment, is_user_move, player_color)
                    comment = self._validate_comment(comment, move_san, is_capture, is_user_move, captured_piece_name)
                    print(f"[AI] Generated comment ({len(comment)} chars): {comment[:100]}...")

                    # Cache the comment
                    if hasattr(self._comment_cache, 'set'):
                        self._comment_cache.set(cache_key, comment)
                    elif isinstance(self._comment_cache, dict):
                        self._comment_cache[cache_key] = comment

                    return comment

            print("[AI] Response had no content")
            return None

        except Exception as e:
            import traceback
            print(f"[AI] Error generating AI comment (async): {e}")
            print(f"[AI] Full traceback: {traceback.format_exc()}")
            return None

    async def _call_api_async(self, prompt: str, system: str) -> Optional[str]:
        """
        Async API call to Anthropic.
        Uses httpx.AsyncClient for non-blocking HTTP requests.
        """
        if not self.enabled or not self.client:
            return None

        try:
            import httpx

            # Create async HTTP client
            timeout = httpx.Timeout(
                connect=10.0,
                read=self.config.api_timeout,
                write=10.0,
                pool=10.0
            )

            async with httpx.AsyncClient(timeout=timeout) as async_client:
                # Build request
                headers = {
                    "x-api-key": self.config.anthropic_api_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json"
                }

                payload = {
                    "model": self.config.ai_model,
                    "max_tokens": self.config.max_tokens,
                    "temperature": self.config.temperature,
                    "system": system,
                    "messages": [{"role": "user", "content": prompt}]
                }

                response = await async_client.post(
                    "https://api.anthropic.com/v1/messages",
                    headers=headers,
                    json=payload
                )

                if response.status_code == 200:
                    data = response.json()
                    if "content" in data and len(data["content"]) > 0:
                        return data["content"][0].get("text", "")
                elif response.status_code == 429:
                    print(f"[AI] ⚠️  Rate limit exceeded (429), skipping AI comment")
                    return None
                else:
                    print(f"[AI] API call failed with status {response.status_code}: {response.text}")
                    return None

        except Exception as e:
            print(f"[AI] Error in async API call: {e}")
            return None

    def _filter_insights_for_move(self, insights: list, move_san: str, is_capture: bool, is_user_move: bool) -> list:
        """Filter insights to only include those relevant to the current move."""
        if not insights:
            return []

        filtered = []
        for insight in insights:
            insight_lower = insight.lower()

            # Remove generic sacrifice advice if not a capture
            if "sacrifice" in insight_lower and not is_capture:
                continue

            # Remove future move suggestions for opponent moves
            if not is_user_move:
                suggestion_patterns = ["you should", "consider", "look for", "try", "you can", "you could"]
                if any(pattern in insight_lower for pattern in suggestion_patterns):
                    continue

            # Remove generic capture mentions if not a capture
            if not is_capture:
                capture_patterns = ["captures", "capturing", "takes", "taking"]
                if any(pattern in insight_lower for pattern in capture_patterns):
                    # Only skip if it's clearly about a capture, not just mentioning the word
                    if any(word in insight_lower for word in ["piece", "pawn", "knight", "bishop", "rook", "queen"]):
                        continue

            # Include insight if it passes filters
            filtered.append(insight)

        # Limit to 3 most relevant
        return filtered[:3]

    def _validate_comment(self, comment: str, move_san: str, is_capture: bool,
                          is_user_move: bool, captured_piece: Optional[str] = None) -> str:
        """Validate and fix common AI hallucination patterns."""
        if not comment:
            return comment

        # Check for capture mentions when move is not a capture
        if not is_capture:
            # Remove mentions of captures/sacrifices
            patterns_to_remove = [
                r'\bcaptur(?:e|es|ed|ing)\b',
                r'\bsacrific(?:e|es|ed|ing)\b',
                r'\btak(?:e|es|ing)\s+(?:the\s+)?(?:pawn|knight|bishop|rook|queen)',
            ]
            for pattern in patterns_to_remove:
                comment = re.sub(pattern, '', comment, flags=re.IGNORECASE)

        # For opponent moves, remove suggestions to user
        if not is_user_move:
            suggestion_patterns = [
                r'\byou\s+(?:should|can|could|might|may)\s+',
                r'\bconsider\s+',
                r'\blook\s+for\s+',
                r'\btry\s+',
                r'\byou\s+should\s+',
            ]
            for pattern in suggestion_patterns:
                comment = re.sub(pattern, '', comment, flags=re.IGNORECASE)

        # Clean up double spaces and punctuation
        comment = re.sub(r'\s+', ' ', comment)
        comment = comment.strip()

        # Remove leading/trailing punctuation artifacts
        comment = re.sub(r'^[,\s]+', '', comment)
        comment = re.sub(r'[,\s]+$', '', comment)

        return comment

    def _clean_comment(self, comment: str, is_user_move: bool = True, player_color: str = 'white') -> str:
        """Remove common interjections at the start of comments and limit to 3-4 sentences maximum.

        Also replaces any second-person pronouns with color-based references (White/Black).
        """
        if not comment:
            return comment

        comment = comment.strip()
        # Remove common prefixes
        for prefix in ["Ah, ", "Ah ", "Oh, ", "Oh ", "Well, ", "Well "]:
            if comment.startswith(prefix):
                comment = comment[len(prefix):].strip()
                # Capitalize first letter if needed
                if comment and comment[0].islower():
                    comment = comment[0].upper() + comment[1:]
                break  # Only remove one prefix

        # Clean up "the player's" references
        pattern = r'\bthe player\'s\b'
        comment = re.sub(pattern, 'the', comment, flags=re.IGNORECASE)

        # Replace any second-person pronouns with color-based references
        color_name = player_color.capitalize()  # "White" or "Black"

        # Map of "you [verb]" -> "color [conjugated verb]"
        verb_replacements = {
            'create': 'creates',
            'capture': 'captures',
            'develop': 'develops',
            'improve': 'improves',
            'control': 'controls',
            'dominate': 'dominates',
            'threaten': 'threatens',
            'attack': 'attacks',
            'defend': 'defends',
            'sacrifice': 'sacrifices',
            'exchange': 'exchanges',
            'trade': 'trades',
            'gain': 'gains',
            'lose': 'loses',
            'weaken': 'weakens',
            'strengthen': 'strengthens',
            'advance': 'advances',
            'retreat': 'retreats',
            'maintain': 'maintains',
            'establish': 'establishes',
            'challenge': 'challenges',
            'undermine': 'undermines',
            'play': 'plays',
            'make': 'makes',
            'take': 'takes',
            'give': 'gives',
            'build': 'builds',
            'force': 'forces',
            'push': 'pushes',
            'open': 'opens',
            'close': 'closes',
            'activate': 'activates',
            'neutralize': 'neutralizes',
            'find': 'finds',
            'miss': 'misses',
        }

        # Replace "you [verb]" with "color [conjugated verb]"
        for base_verb, conjugated_verb in verb_replacements.items():
            pattern = rf'\byou\s+{base_verb}\b'
            replacement = f'{color_name} {conjugated_verb}'
            comment = re.sub(pattern, replacement, comment, flags=re.IGNORECASE)

        # Handle "you have" -> "color has"
        comment = re.sub(r'\byou\s+have\b', f'{color_name} has', comment, flags=re.IGNORECASE)

        # Handle "you are" -> "color is"
        comment = re.sub(r'\byou\s+are\b', f'{color_name} is', comment, flags=re.IGNORECASE)

        # Handle "you've" -> "color has"
        comment = re.sub(r"\byou've\b", f'{color_name} has', comment, flags=re.IGNORECASE)

        # Handle "you're" -> "color is"
        comment = re.sub(r"\byou're\b", f'{color_name} is', comment, flags=re.IGNORECASE)

        # Replace "your opponent" with the opposite color
        opposite_color = "Black" if color_name == "White" else "White"
        comment = re.sub(r'\byour opponent\b', opposite_color, comment, flags=re.IGNORECASE)

        # Replace remaining "you" with color name (catch-all)
        comment = re.sub(r'\byou\b', color_name, comment, flags=re.IGNORECASE)

        # Replace "your" with "color's" (possessive)
        comment = re.sub(r'\byour\b', f"{color_name}'s", comment, flags=re.IGNORECASE)

        # Limit to 3 sentences maximum (strictly enforced)
        # Use regex to split on sentence endings (period, exclamation, question mark)
        # Split on sentence endings, keeping the punctuation
        sentence_pattern = r'([^.!?]*[.!?]+)'
        sentences = re.findall(sentence_pattern, comment)

        # If no sentences found (unlikely), try simple split
        if not sentences:
            # Fallback: split on punctuation
            parts = re.split(r'([.!?]+)', comment)
            sentences = []
            for i in range(0, len(parts) - 1, 2):
                if i + 1 < len(parts):
                    sentence = (parts[i] + parts[i + 1]).strip()
                    if sentence:
                        sentences.append(sentence)

        # Add any remaining text if it doesn't end with punctuation
        remaining = comment[len(''.join(sentences)):].strip()
        if remaining and remaining not in ''.join(sentences):
            sentences.append(remaining)

        # Filter out incomplete sentences (ending with ".." or without proper punctuation)
        complete_sentences = [s for s in sentences if s and s.endswith(('.', '!', '?')) and not s.endswith('..')]

        # If no complete sentences found, try to use original comment
        if not complete_sentences:
            # Check if original comment ends properly
            if comment.endswith(('.', '!', '?')) and not comment.endswith('..'):
                return comment.strip()
            # Otherwise, try to fix it by removing trailing ".."
            comment = comment.rstrip('.')
            if comment and not comment.endswith(('.', '!', '?')):
                comment += "."
            return comment.strip()

        # Strictly limit to 3 sentences maximum
        if len(complete_sentences) > 3:
            complete_sentences = complete_sentences[:3]

        comment = " ".join(complete_sentences)

        # Ensure it ends with proper punctuation
        if comment and not comment.endswith(('.', '!', '?')):
            comment += "."

        return comment.strip()

    def _call_api_with_fallback(
        self,
        prompt: str,
        system: str,
        max_tokens: int = None,
        temperature: float = None
    ) -> Optional[str]:
        """
        Call Anthropic API with automatic model fallback on 404 errors.
        Includes rate limiting to prevent overwhelming the API.

        Args:
            prompt: The user prompt
            system: The system prompt
            max_tokens: Maximum tokens (defaults to config value)
            temperature: Temperature (defaults to config value)

        Returns:
            Generated text or None if all attempts failed
        """
        if not self.enabled or not self.client:
            return None

        # Rate limiting: ensure we don't make API calls too fast
        with self._rate_limit_lock:
            current_time = time.time()
            time_since_last_call = current_time - self._last_api_call_time
            if time_since_last_call < self._rate_limit_delay:
                sleep_time = self._rate_limit_delay - time_since_last_call
                print(f"[AI] Rate limiting: waiting {sleep_time:.2f}s before API call")
                time.sleep(sleep_time)
            self._last_api_call_time = time.time()

        max_tokens = max_tokens or self.config.max_tokens
        temperature = temperature if temperature is not None else self.config.temperature

        # List of models to try (in order of preference)
        # Known working models that should be available to all API keys
        known_working_models = [
            "claude-3-haiku-20240307",     # Claude 3 Haiku (most reliable, fastest, cheapest)
            "claude-3-sonnet-20240229",    # Claude 3 Sonnet (Feb 2024 - reliable fallback)
        ]

        # Models that may not be available to all API keys
        optional_models = [
            "claude-3-5-sonnet",            # Claude 3.5 Sonnet (latest version - best quality)
            "claude-3-5-sonnet-20240620",   # Claude 3.5 Sonnet (June 2024 - may not be available to all API keys)
        ]

        # Build model list: try configured model first if it's a known working one,
        # otherwise try known working models first, then configured model, then optional models
        models_to_try = []

        # If configured model is in known working models, try it first
        if self.config.ai_model in known_working_models:
            models_to_try.append(self.config.ai_model)
            # Add other known working models
            for model in known_working_models:
                if model != self.config.ai_model:
                    models_to_try.append(model)
        else:
            # Try known working models first (they're more reliable)
            models_to_try.extend(known_working_models)
            # Then try configured model
            if self.config.ai_model not in models_to_try:
                models_to_try.append(self.config.ai_model)

        # Add optional models if not already in list
        for model in optional_models:
            if model not in models_to_try:
                models_to_try.append(model)

        # Remove duplicates while preserving order
        seen = set()
        unique_models = []
        for model in models_to_try:
            if model not in seen:
                seen.add(model)
                unique_models.append(model)

        last_error = None
        # Use configurable timeout from config (default 60s, much better than 10s)
        # The httpx timeout is already configured in the client, but we keep this
        # for additional safety and logging

        for model in unique_models:
            try:
                print(f"[AI] Attempting API call with model: {model} (timeout: {self.config.api_timeout}s)")

                # The httpx timeout is already configured in the client initialization
                # This will automatically timeout after api_timeout seconds
                response = self.client.messages.create(
                    model=model,
                    max_tokens=max_tokens,
                    temperature=temperature,
                    system=system,
                    messages=[{"role": "user", "content": prompt}]
                )

                if not response:
                    print(f"[AI] ⚠️  Empty response from model {model}")
                    continue

                if response.content and len(response.content) > 0:
                    comment = response.content[0].text.strip()
                    if model != self.config.ai_model:
                        print(f"[AI] ✅ Successfully generated using model: {model} (configured model was {self.config.ai_model})")
                        print(f"[AI] 💡 Update your .env.local: AI_MODEL={model}")
                    return comment
                else:
                    print(f"[AI] ⚠️  Response from {model} had no content")
                    continue

            except Exception as e:
                error_msg = str(e)
                last_error = e

                # Check for timeout errors - fail fast to prevent blocking
                if "timeout" in error_msg.lower() or "timed out" in error_msg.lower():
                    print(f"[AI] ⚠️  API call timeout ({self.config.api_timeout}s) for model {model}. Skipping to prevent blocking analysis.")
                    print(f"[AI] 💡 This is expected if API is slow. Analysis will continue with template comments.")
                    # Don't try other models if we're timing out - likely API issue
                    break

                # If it's a 404 (model not found), try next model immediately (no need to wait)
                if "404" in error_msg or "not_found" in error_msg.lower():
                    if model == self.config.ai_model:
                        print(f"[AI] ❌ Model {model} not found (404). Trying alternatives...")
                    else:
                        print(f"[AI]   Model {model} also not found (404). Trying next...")
                    continue
                elif "429" in error_msg or "rate_limit" in error_msg.lower() or "too many requests" in error_msg.lower():
                    # Rate limit error - fail fast to prevent blocking
                    print(f"[AI] ⚠️  Rate limit exceeded (429) for model {model}. Skipping AI comment to prevent blocking analysis.")
                    print(f"[AI] 💡 Analysis will continue with template comments. This is expected when analyzing many games.")
                    # Don't try other models if we're rate limited - likely too many concurrent requests
                    break
                else:
                    # For other errors, log but continue trying
                    print(f"[AI]   Model {model} failed with error: {error_msg}")
                    continue

        # All models failed
        print(f"[AI] ❌ All model attempts failed.")
        if last_error:
            print(f"[AI] Last error: {last_error}")
        print(f"[AI] Please check:")
        print(f"[AI]   1. Your API key has access to Claude models")
        print(f"[AI]   2. Your Anthropic account is active")
        print(f"[AI]   3. Try logging into console.anthropic.com to verify access")
        return None

    def _build_prompt(
        self,
        move_analysis: Dict[str, Any],
        board: chess.Board,
        move: chess.Move,
        is_user_move: bool,
        player_elo: int
    ) -> str:
        """Build a Tal-inspired prompt that explains the idea and principle behind moves."""

        # Extract key information
        move_san = move_analysis.get('move_san', '')
        move_quality = self._get_move_quality(move_analysis)
        best_move_san = move_analysis.get('best_move_san', '')
        centipawn_loss = move_analysis.get('centipawn_loss', 0)

        # Get position context
        game_phase = move_analysis.get('game_phase', 'middlegame')
        move_number = move_analysis.get('fullmove_number', 0)

        # Identify opening from move sequence
        opening_name = ""
        move_sequence = move_analysis.get('move_sequence', [])
        if move_sequence and len(move_sequence) >= 2:
            first_two = move_sequence[:2]
            if first_two == ['e4', 'e5']:
                opening_name = "King's Pawn Game"
            elif first_two == ['e4', 'c5']:
                opening_name = "Sicilian Defense"
            elif first_two == ['e4', 'e6']:
                opening_name = "French Defense"
            elif first_two == ['e4', 'c6']:
                opening_name = "Caro-Kann Defense"
            elif first_two == ['d4', 'd5']:
                opening_name = "Queen's Pawn Game"
            elif first_two == ['d4', 'Nf6']:
                opening_name = "Indian Defense"
            elif first_two == ['e4', 'd5']:
                opening_name = "Scandinavian Defense"
            elif first_two == ['e4', 'Nf6']:
                opening_name = "Alekhine Defense"

        # Also check opening_info if available
        if not opening_name:
            opening_info = move_analysis.get('opening_info', {})
            if opening_info and opening_info.get('name'):
                opening_name = opening_info['name']

        # Tactical and positional insights
        tactical_insights = move_analysis.get('tactical_insights', [])
        positional_insights = move_analysis.get('positional_insights', [])

        # Get Stockfish analysis data
        best_move_pv = move_analysis.get('best_move_pv', [])  # Principal Variation from Stockfish
        depth_analyzed = move_analysis.get('depth_analyzed', 0)  # Stockfish depth
        evaluation_before = move_analysis.get('evaluation_before')
        evaluation_after = move_analysis.get('evaluation_after')
        evaluation = move_analysis.get('evaluation', {})  # Stockfish evaluation object

        # Build FEN and move notation context
        fen_after = board.fen()

        # Get position before the move and capture information
        board_before = move_analysis.get('board_before')
        fen_before = ""
        capture_info = ""
        is_capture = False
        captured_piece_name = None
        is_sacrifice = False

        if board_before and move:
            try:
                fen_before = board_before.fen()
                # Check if this is a capture move
                captured_piece = board_before.piece_at(move.to_square)

                # VALIDATE: Cross-check capture detection
                move_san = move_analysis.get('move_san', '')
                has_capture_notation = 'x' in move_san

                if captured_piece:
                    # Board shows a piece on target square
                    if not has_capture_notation:
                        print(f"[AI WARNING] board_before shows piece on {chess.square_name(move.to_square)} but move_san '{move_san}' has no 'x' - possible board corruption")
                        # Treat as non-capture to avoid false information
                        is_capture = False
                        captured_piece = None
                    else:
                        is_capture = True
                        piece_names = {
                            chess.PAWN: "pawn",
                            chess.KNIGHT: "knight",
                            chess.BISHOP: "bishop",
                            chess.ROOK: "rook",
                            chess.QUEEN: "queen",
                            chess.KING: "king"
                        }
                        piece_name = piece_names.get(captured_piece.piece_type, "piece")
                        color = "white" if captured_piece.color == chess.WHITE else "black"
                        captured_piece_name = f"{color} {piece_name}"

                        # Log successful capture detection
                        print(f"[AI CAPTURE VALIDATED] {move_san} captures {color} {piece_name} on {chess.square_name(move.to_square)}")

                if captured_piece and is_capture:
                    # Check if this is a sacrifice (using SEE score or heuristic_details)
                    heuristic_details = move_analysis.get('heuristic_details', {})
                    see_score = heuristic_details.get('see', 0)
                    # Only mark as sacrifice if SEE is significantly negative (losing at least 1 pawn worth)
                    if see_score < -100:
                        is_sacrifice = True
                        capture_info = f"""
**CAPTURE INFORMATION (ONLY FOR THIS MOVE):**
- This move ({move_san}) captures the {color} {piece_name} on {chess.square_name(move.to_square)}
- This is a SACRIFICE (losing material for tactical/positional compensation)
- This is the ONLY capture in this move
- Do NOT mention any other captures or sacrifices"""
                    else:
                        capture_info = f"""
**CAPTURE INFORMATION (ONLY FOR THIS MOVE):**
- This move ({move_san}) captures the {color} {piece_name} on {chess.square_name(move.to_square)}
- This is the ONLY capture in this move
- Do NOT mention any other captures or sacrifices"""
                        print(f"[AI PROMPT] CAPTURE INFO for {move_san}: captures {color} {piece_name} on {chess.square_name(move.to_square)}")
                else:
                    # Explicitly state when it's NOT a capture to prevent AI hallucination
                    capture_info = f"""
**NO CAPTURE IN THIS MOVE:**
- This move ({move_san}) does NOT capture any piece
- Do NOT mention captures, sacrifices, or material exchanges
- Focus on the move's positional or tactical purpose"""
            except Exception as e:
                print(f"[AI] Warning: Could not extract capture info: {e}")

        # Determine complexity level based on ELO
        if player_elo < 900:
            complexity = "beginner"
            tal_style = "clear and accessible, focusing on fundamental principles with enthusiasm"
        elif player_elo < 1400:
            complexity = "intermediate"
            tal_style = "engaging and instructive, explaining principles clearly with energy"
        else:
            complexity = "advanced intermediate"
            tal_style = "analytical and insightful, teaching advanced concepts with clarity"

        # Determine style intensity based on move quality
        if move_quality in [MoveQuality.BRILLIANT, MoveQuality.BLUNDER]:
            style_intensity = "highly analytical—explain the tactical and positional reasoning clearly, teach why this matters"
        elif move_quality in [MoveQuality.MISTAKE, MoveQuality.EXCELLENT]:
            style_intensity = "strong analytical focus—explain principles and patterns, what works and why"
        else:
            style_intensity = "teaching-focused—explain the chess principles clearly, build understanding"

        # Convert centipawn loss to descriptive language
        if centipawn_loss > 100:
            eval_description = "a decisive advantage"
            eval_explanation = "This creates a significant shift that dramatically changes the position."
            eval_verb = "loses"
        elif centipawn_loss > 50:
            eval_description = "a substantial advantage"
            eval_explanation = "This creates a noticeable shift that gives meaningful control."
            eval_verb = "loses"
        elif centipawn_loss > 25:
            eval_description = "a small advantage"
            eval_explanation = "This creates a subtle shift that provides a slight edge."
            eval_verb = "loses"
        elif centipawn_loss > 0:
            eval_description = "a tiny advantage"
            eval_explanation = "This creates a minimal shift, barely noticeable but still present."
            eval_verb = "loses"
        elif centipawn_loss < 0:
            eval_description = "an advantage"
            eval_explanation = "This improves the position."
            eval_verb = "gains"
        else:
            eval_description = "the position"
            eval_explanation = "This maintains the position effectively."
            eval_verb = "maintains"

        # Filter tactical and positional insights to only include relevant ones
        filtered_tactical = self._filter_insights_for_move(tactical_insights, move_san, is_capture, is_user_move)
        filtered_positional = self._filter_insights_for_move(positional_insights, move_san, is_capture, is_user_move)

        # Build hanging pieces context (CRITICAL for mistake detection)
        hanging_pieces_context = ""
        heuristic_details = move_analysis.get('heuristic_details', {})
        new_hanging = heuristic_details.get('new_hanging_pieces', [])

        if new_hanging:
            hanging_pieces_context = f"\n**CRITICAL TACTICAL ISSUE - HANGING PIECES:**\n"
            for hanging in new_hanging:
                piece_symbol = hanging.get('piece', '?')
                square = hanging.get('square', '?')
                piece_names = {
                    'P': 'pawn', 'p': 'pawn',
                    'N': 'knight', 'n': 'knight',
                    'B': 'bishop', 'b': 'bishop',
                    'R': 'rook', 'r': 'rook',
                    'Q': 'queen', 'q': 'queen',
                    'K': 'king', 'k': 'king'
                }
                piece_name = piece_names.get(piece_symbol, 'piece')
                attackers = hanging.get('attackers', 0)
                defenders = hanging.get('defenders', 0)
                hanging_pieces_context += f"- {piece_name.title()} on {square} is hanging ({attackers} attackers vs {defenders} defenders)\n"
            hanging_pieces_context += f"- This is the MOST IMPORTANT tactical issue in this position - MUST be mentioned!\n"

        # Build tactical context
        tactical_context = ""
        if filtered_tactical:
            tactical_context = f"\n**TACTICAL IDEAS IN THE POSITION:**\n"
            for insight in filtered_tactical:
                tactical_context += f"- {insight}\n"

        positional_context = ""
        if filtered_positional:
            positional_context = f"\n**POSITIONAL THEMES:**\n"
            for insight in filtered_positional:
                positional_context += f"- {insight}\n"

        # Build ACTUAL BOARD STATE context (CRITICAL for accuracy - prevents hallucination)
        board_state_context = ""
        if board:
            try:
                board_state_context = f"\n**ACTUAL BOARD STATE (VERIFY BEFORE MENTIONING ANY PIECE):**\n"

                # List all pieces on the board with their exact locations
                piece_locations = []
                for square in chess.SQUARES:
                    piece = board.piece_at(square)
                    if piece:
                        square_name = chess.square_name(square)
                        piece_names_map = {
                            chess.PAWN: "pawn", chess.KNIGHT: "knight", chess.BISHOP: "bishop",
                            chess.ROOK: "rook", chess.QUEEN: "queen", chess.KING: "king"
                        }
                        piece_name = piece_names_map.get(piece.piece_type, "piece")
                        color = "White" if piece.color == chess.WHITE else "Black"
                        piece_locations.append(f"{color} {piece_name} on {square_name}")

                # Add to context (show all pieces for accuracy)
                board_state_context += "- " + "\n- ".join(piece_locations)
                board_state_context += f"\n\n**CRITICAL ACCURACY RULES:**\n"
                board_state_context += f"- ONLY mention pieces that are EXACTLY on the squares listed above\n"
                board_state_context += f"- NEVER say 'knight on d4' unless you see 'knight on d4' in the list above\n"
                board_state_context += f"- NEVER say 'bishop on e5' unless you see 'bishop on e5' in the list above\n"
                board_state_context += f"- If you mention pinning/attacking/defending a piece, VERIFY its exact square from the list\n"
                board_state_context += f"- If unsure about a piece location, DO NOT mention it - be vague instead\n"

            except Exception as e:
                # Could not generate board state context - continue without it

        # Build Stockfish analysis context
        stockfish_context = ""
        if depth_analyzed > 0:
            stockfish_context = f"\n**STOCKFISH ANALYSIS (depth {depth_analyzed}):**\n"

            # Add evaluation information
            if evaluation_before is not None and evaluation_after is not None:
                eval_before_str = f"{evaluation_before/100:+.2f}" if abs(evaluation_before) < 10000 else "mate"
                eval_after_str = f"{evaluation_after/100:+.2f}" if abs(evaluation_after) < 10000 else "mate"
                stockfish_context += f"- Evaluation before move: {eval_before_str} (from White's perspective)\n"
                stockfish_context += f"- Evaluation after move: {eval_after_str} (from White's perspective)\n"

            # Add Principal Variation (best continuation line)
            if best_move_pv and len(best_move_pv) > 0:
                # Convert PV from UCI to SAN for readability
                try:
                    pv_san = []
                    temp_board = board_before.copy() if board_before else board.copy()
                    if board_before:
                        # PV is from position before the move
                        for uci_move in best_move_pv[:6]:  # Show first 6 moves of PV
                            try:
                                move_obj = chess.Move.from_uci(uci_move)
                                if move_obj in temp_board.legal_moves:
                                    san_move = temp_board.san(move_obj)
                                    pv_san.append(san_move)
                                    temp_board.push(move_obj)
                                else:
                                    break
                            except:
                                break

                    if pv_san:
                        pv_line = " ".join(pv_san)
                        stockfish_context += f"- Best continuation (Principal Variation): {pv_line}\n"
                        stockfish_context += f"  (This shows Stockfish's calculated best line from this position)\n"
                except Exception as e:
                    print(f"[AI] Warning: Could not convert PV to SAN: {e}")

        # Add opening context if available (only for early moves to save tokens)
        opening_context = ""
        if opening_name and move_number <= 3:
            opening_context = f"\n**OPENING:** {opening_name}\n"

        # Add move sequence context to help distinguish current vs previous moves
        previous_move_context = ""
        if move_number > 1:
            previous_move = move_analysis.get('previous_move_san', '')
            if previous_move:
                previous_move_context = f"\n**MOVE SEQUENCE:** Previous move: {previous_move}. Current move: {move_san}."

        # Special handling for first move - keep it short and Tal'ish
        # Both White's first move and Black's first move have fullmove_number == 1
        # Additional check: ensure this is actually one of the first two moves (ply 1 or 2) if ply_index is available
        ply_index = move_analysis.get('ply_index', None)
        if move_number == 1:
            # If ply_index is available, verify it's one of the first two moves
            # Otherwise, just trust fullmove_number == 1
            if ply_index is None or ply_index in [1, 2]:
                move_owner = "the player" if is_user_move else "the opponent"
                prompt = f"""{move_owner.capitalize()} just started the game with {move_san} (move 1).

**YOUR MISSION (Tal-Style Commentary):**
Write ONE short, encouraging sentence (maximum 15 words) that captures the excitement of starting a game. Channel Mikhail Tal's playful, energetic spirit. Be brief, cheerful, and inspiring—something like "The adventure begins!" or "Time to bring out your forces!" Keep it light and encouraging, not technical or educational.

**CRITICAL RULES:**
- ONE sentence maximum, 15 words or less
- Be encouraging and energetic, like Tal
- NO technical explanations, NO long descriptions
- {"Just cheer them on for starting the game!" if is_user_move else "Acknowledge the game beginning with enthusiasm!"}

Write the comment now:"""
                return prompt

        # Get player color from move analysis
        player_color = move_analysis.get('player_color', 'white')

        # Route to appropriate prompt builder based on move type
        if not is_user_move:
            return self._build_opponent_move_prompt(
                move_san, move_number, player_elo, complexity, game_phase,
                opening_context, previous_move_context, capture_info, is_capture,
                move_quality, eval_verb, eval_description, eval_explanation,
                board_state_context, stockfish_context, hanging_pieces_context, tactical_context, positional_context,
                fen_after, best_move_san, tal_style, player_color
            )
        else:
            return self._build_user_move_prompt(
                move_san, move_number, player_elo, complexity, game_phase,
                opening_context, previous_move_context, capture_info, is_capture,
                move_quality, eval_verb, eval_description, eval_explanation,
                board_state_context, stockfish_context, hanging_pieces_context, tactical_context, positional_context,
                fen_after, best_move_san, tal_style, player_color
            )

    def _build_opponent_move_prompt(
        self, move_san: str, move_number: int, player_elo: int, complexity: str,
        game_phase: str, opening_context: str, previous_move_context: str,
        capture_info: str, is_capture: bool, move_quality: MoveQuality,
        eval_verb: str, eval_description: str, eval_explanation: str,
        board_state_context: str, stockfish_context: str, hanging_pieces_context: str, tactical_context: str, positional_context: str,
        fen_after: str, best_move_san: str, tal_style: str, player_color: str
    ) -> str:
        """Build prompt specifically for opponent moves - analyze what opponent did."""
        color_name = player_color.capitalize()  # "White" or "Black"

        task_description = ""
        if move_quality == MoveQuality.BRILLIANT:
            task_description = f"Analyze what {color_name} did with this brilliant move and why it's strong."
        elif move_quality in [MoveQuality.MISTAKE, MoveQuality.BLUNDER, MoveQuality.INACCURACY]:
            task_description = f"Analyze what {color_name} did with this move and why it's problematic."
        else:
            task_description = f"Analyze what {color_name} did with this move and its purpose."

        prompt = f"""Player {player_elo} ELO ({complexity}) played {move_san} in {game_phase} (move {move_number}).
{opening_context}{previous_move_context}{capture_info}{hanging_pieces_context}
**MOVE QUALITY:** {move_quality.value} | {color_name}'s move
**EVALUATION:** This move {eval_verb} {eval_description}. {eval_explanation}
{board_state_context}
{stockfish_context}
{tactical_context}{positional_context}
**POSITION:** {fen_after}

**TASK:** Write 2-3 sentences analyzing what {color_name} did with this move. {task_description} Style: {tal_style}. Focus on analyzing their move's purpose and consequences.

**RULES:**
- Start directly (no "Ah," "Oh,")
- Use chess terms, not numbers or "centipawns/evaluation/engine"
- Be specific: "weakens the position" not "is a good move"
- Use "{color_name}" when referring to the player who made this move (never "you" or "your opponent")
- 2-3 sentences max, clear and instructive
- CRITICAL: If HANGING PIECES are listed above, you MUST mention them in your comment - this is the most important tactical issue!
- CRITICAL: Analyze what {color_name} did, NOT what the other player should do in response
- CRITICAL: Only mention captures/sacrifices that occurred in THIS specific move ({move_san})
- CRITICAL: Do NOT infer sacrifices from position context or previous moves
- CRITICAL: The CAPTURE section above is the ONLY capture information - do not mention other captures
- CRITICAL: If the move is NOT A CAPTURE, do NOT mention capturing anything
- CRITICAL: Only mention captures if the CAPTURE section explicitly states a piece was captured
- CRITICAL: NEVER mention a piece on a square unless it's listed in the ACTUAL BOARD STATE section above
- CRITICAL: If you say "knight on d4" or "bishop on e5", VERIFY that exact piece is on that exact square in the board state list
{"Mention better move " + best_move_san + " if relevant (what " + color_name + " should have played)." if best_move_san and move_quality not in [MoveQuality.BRILLIANT, MoveQuality.BEST] else ""}

Write comment:"""
        return prompt

    def _build_user_move_prompt(
        self, move_san: str, move_number: int, player_elo: int, complexity: str,
        game_phase: str, opening_context: str, previous_move_context: str,
        capture_info: str, is_capture: bool, move_quality: MoveQuality,
        eval_verb: str, eval_description: str, eval_explanation: str,
        board_state_context: str, stockfish_context: str, hanging_pieces_context: str, tactical_context: str, positional_context: str,
        fen_after: str, best_move_san: str, tal_style: str, player_color: str
    ) -> str:
        """Build prompt for user moves - explain the principle and idea behind the move."""
        color_name = player_color.capitalize()  # "White" or "Black"

        prompt = f"""Player {player_elo} ELO ({complexity}) played {move_san} in {game_phase} (move {move_number}).
{opening_context}{previous_move_context}{capture_info}{hanging_pieces_context}
**MOVE QUALITY:** {move_quality.value} | {color_name}'s move
**EVALUATION:** This move {eval_verb} {eval_description}. {eval_explanation}
{board_state_context}
{stockfish_context}
{tactical_context}{positional_context}
**POSITION:** {fen_after}

**TASK:** Write 2-3 sentences explaining the *principle* and *idea* behind this move. Style: {tal_style}. {"Focus on brilliant reasoning and principles demonstrated." if move_quality == MoveQuality.BRILLIANT else "Explain what went wrong tactically/positionally and what should be played instead." if move_quality in [MoveQuality.MISTAKE, MoveQuality.BLUNDER, MoveQuality.INACCURACY] else "Explain the reasoning and how it improves the position."} Focus on what {color_name} did.

**RULES:**
- Start directly (no "Ah," "Oh,")
- Use chess terms, not numbers or "centipawns/evaluation/engine"
- Be specific: "loses the attack" not "is a good move"
- Use "{color_name}" when referring to the player who made this move (never "you" or "your")
- 2-3 sentences max, clear and instructive
- CRITICAL: If HANGING PIECES are listed above, you MUST mention them in your comment - this is the most important tactical issue!
- CRITICAL: Only mention captures/sacrifices that occurred in THIS specific move ({move_san})
- CRITICAL: Do NOT infer sacrifices from position context or previous moves
- CRITICAL: The CAPTURE section above is the ONLY capture information - do not mention other captures
- CRITICAL: If the move is NOT A CAPTURE, do NOT mention capturing anything
- CRITICAL: Only mention captures if the CAPTURE section explicitly states a piece was captured
- CRITICAL: NEVER mention a piece on a square unless it's listed in the ACTUAL BOARD STATE section above
- CRITICAL: If you say "knight on d4" or "bishop on e5", VERIFY that exact piece is on that exact square in the board state list
{"Mention better move " + best_move_san + " if relevant (what " + color_name + " should have played)." if best_move_san and move_quality not in [MoveQuality.BRILLIANT, MoveQuality.BEST] else ""}

Write comment:"""
        return prompt

    def _get_move_quality(self, move_analysis: Dict[str, Any]) -> MoveQuality:
        """Determine move quality from analysis data."""
        if move_analysis.get('is_brilliant', False):
            return MoveQuality.BRILLIANT
        elif move_analysis.get('is_best', False):
            return MoveQuality.BEST
        elif move_analysis.get('is_excellent', False) or move_analysis.get('is_great', False):
            return MoveQuality.EXCELLENT
        elif move_analysis.get('is_good', False) or move_analysis.get('is_acceptable', False):
            return MoveQuality.GOOD
        elif move_analysis.get('is_inaccuracy', False):
            return MoveQuality.INACCURACY
        elif move_analysis.get('is_mistake', False):
            return MoveQuality.MISTAKE
        elif move_analysis.get('is_blunder', False):
            return MoveQuality.BLUNDER
        else:
            return MoveQuality.GOOD

    def _generate_cache_key(self, move_analysis: Dict[str, Any], board: chess.Board, move: chess.Move, is_user_move: bool, player_elo: int) -> str:
        """
        Generate a cache key for AI comments.

        Cache key is based on:
        - FEN position (after move)
        - Move SAN notation
        - Move quality
        - ELO range (rounded to nearest 200 for grouping similar skill levels)
        - Whether it's user's move or opponent's

        This allows caching comments for identical positions/moves across different games.
        """
        fen = board.fen()
        move_san = move_analysis.get('move_san', '')
        move_quality = self._get_move_quality(move_analysis)

        # Round ELO to nearest 200 to group similar skill levels
        # This allows comments to be reused for players of similar skill
        elo_range = (player_elo // 200) * 200

        # Create cache key from position + move + quality + ELO range + move owner
        cache_data = f"{fen}|{move_san}|{move_quality.value}|{elo_range}|{'user' if is_user_move else 'opponent'}"

        # Use hash to keep key size manageable
        cache_key = hashlib.md5(cache_data.encode()).hexdigest()
        return f"ai_comment:{cache_key}"

    def generate_style_analysis(
        self,
        personality_scores: Dict[str, float],
        player_style: Dict[str, Any],
        player_level: str,
        total_games: int,
        average_accuracy: float,
        phase_accuracies: Dict[str, float]
    ) -> Optional[Dict[str, str]]:
        """
        Generate AI-powered style analysis content for player profile.

        Args:
            personality_scores: Dictionary of personality trait scores (tactical, positional, aggressive, patient, novelty, staleness)
            player_style: Dictionary with player style category and confidence
            player_level: Player skill level (beginner, intermediate, advanced, expert)
            total_games: Total number of games analyzed
            average_accuracy: Average move accuracy percentage
            phase_accuracies: Dictionary with 'opening', 'middle', 'endgame' accuracy percentages

        Returns:
            Dictionary with style analysis fields, or None if AI is disabled/failed
        """
        if not self.enabled:
            print("[AI] Generator is not enabled for style analysis")
            return None

        if not self.client:
            print("[AI] Anthropic client is not initialized for style analysis")
            return None

        try:
            print(f"[AI] Generating style analysis for {player_level} player with {total_games} games")

            # Build comprehensive prompt with all player data
            prompt = self._build_style_analysis_prompt(
                personality_scores,
                player_style,
                player_level,
                total_games,
                average_accuracy,
                phase_accuracies
            )

            system_prompt = """You are a chess analyst creating personalized style profiles for players. Your analysis is:
- Data-driven and specific: Use actual scores and percentages when relevant
- Insightful and educational: Explain what the scores mean and how they translate to playing style
- Encouraging and constructive: Highlight strengths while providing actionable improvement guidance
- Clear and concise: Write in a natural, engaging style that helps players understand their chess identity
- Personalized: Tailor your analysis to match the player's level and unique profile

Focus on teaching chess concepts and helping players understand their playing style."""

            # Use longer max_tokens for style analysis (more comprehensive content)
            result = self._call_api_with_fallback(
                prompt=prompt,
                system=system_prompt,
                max_tokens=800,  # More tokens for comprehensive analysis
                temperature=0.7  # Slightly lower for more consistent, analytical output
            )

            if result:
                # Parse the AI response into structured format
                return self._parse_style_analysis_response(result, personality_scores, player_style, player_level, total_games, average_accuracy, phase_accuracies)

            print("[AI] Style analysis response had no content")
            return None

        except Exception as e:
            import traceback
            print(f"[AI] Error generating style analysis: {e}")
            print(f"[AI] Full traceback: {traceback.format_exc()}")
            return None

    def _build_style_analysis_prompt(
        self,
        personality_scores: Dict[str, float],
        player_style: Dict[str, Any],
        player_level: str,
        total_games: int,
        average_accuracy: float,
        phase_accuracies: Dict[str, float]
    ) -> str:
        """Build prompt for AI style analysis generation."""

        # Rank traits
        ranked_traits = sorted(
            ((key, personality_scores.get(key, 0.0)) for key in ['tactical', 'positional', 'aggressive', 'patient', 'novelty', 'staleness']),
            key=lambda item: item[1],
            reverse=True
        )

        dominant_trait, dominant_score = ranked_traits[0]
        second_trait, second_score = ranked_traits[1] if len(ranked_traits) > 1 else (dominant_trait, dominant_score)
        lowest_trait, lowest_score = ranked_traits[-1]

        style_category = player_style.get('category', 'balanced')
        style_confidence = player_style.get('confidence', 0)

        # Format personality scores
        scores_text = "\n".join([f"- {trait}: {score:.1f}" for trait, score in ranked_traits])

        # Format phase accuracies
        phase_text = f"- Opening: {phase_accuracies.get('opening', 0):.1f}%\n- Middlegame: {phase_accuracies.get('middle', 0):.1f}%\n- Endgame: {phase_accuracies.get('endgame', 0):.1f}%"

        prompt = f"""Analyze a chess player's playing style based on their game data:

**PLAYER PROFILE:**
- Level: {player_level}
- Total Games Analyzed: {total_games}
- Average Accuracy: {average_accuracy:.1f}%
- Style Category: {style_category} (confidence: {style_confidence:.0f}%)

**PERSONALITY TRAIT SCORES (0-100):**
{scores_text}

**PHASE ACCURACIES:**
{phase_text}

**YOUR TASK:**
Generate a comprehensive, personalized style analysis in JSON format with these exact fields:

1. **style_summary**: A 2-3 sentence overview describing the player's chess identity, their dominant trait ({dominant_trait} at {dominant_score:.0f}), and how {total_games} games reveal their playing style. Make it personal and engaging.

2. **characteristics**: A concise description (2-3 sentences) of the player's key characteristics. Highlight the top traits ({dominant_trait}, {second_trait}) and explain how they combine to create a unique playing style. Use actual scores when relevant.

3. **strengths**: A specific list of the player's main strengths (2-3 sentences). Mention their best traits ({dominant_trait} at {dominant_score:.0f}, {second_trait} at {second_score:.0f}) and their strongest phase (best phase accuracy). Be specific and encouraging.

4. **playing_patterns**: Explain how the player typically approaches games (2-3 sentences). Describe their playing patterns based on their trait combination. For example, if aggressive > patient, mention they "seek initiative early"; if tactical > positional, mention "calculation in complex positions". Use actual scores when relevant.

5. **improvement_focus**: Specific, actionable guidance (2-3 sentences) on what to focus on for improvement. Highlight their weakest area ({lowest_trait} at {lowest_score:.0f}) and provide concrete suggestions. Also mention their weakest phase if accuracy is below 65%.

**REQUIREMENTS:**
- Use actual scores and percentages when relevant (e.g., "tactical play at 72" or "middlegame accuracy of 68%")
- Be specific and data-driven, not generic
- Write in a natural, engaging style
- Keep each field to 2-3 sentences maximum
- Focus on helping the player understand their chess identity
- Provide actionable improvement guidance

**OUTPUT FORMAT:**
Return ONLY valid JSON with these exact keys:
{{
  "style_summary": "...",
  "characteristics": "...",
  "strengths": "...",
  "playing_patterns": "...",
  "improvement_focus": "..."
}}

Do not include any text outside the JSON. Start directly with {{."""

        return prompt

    def _parse_style_analysis_response(
        self,
        response: str,
        personality_scores: Dict[str, float],
        player_style: Dict[str, Any],
        player_level: str,
        total_games: int,
        average_accuracy: float,
        phase_accuracies: Dict[str, float]
    ) -> Dict[str, str]:
        """Parse AI response into structured style analysis format."""
        import json

        try:
            # Try to extract JSON from response
            # Remove any markdown code blocks
            response = response.strip()
            if response.startswith("```"):
                # Remove markdown code blocks
                lines = response.split("\n")
                response = "\n".join(lines[1:-1]) if len(lines) > 2 else response

            # Try to find JSON object
            if response.startswith("{"):
                # Find the JSON object
                brace_count = 0
                json_start = -1
                json_end = -1

                for i, char in enumerate(response):
                    if char == "{":
                        if json_start == -1:
                            json_start = i
                        brace_count += 1
                    elif char == "}":
                        brace_count -= 1
                        if brace_count == 0:
                            json_end = i + 1
                            break

                if json_start != -1 and json_end != -1:
                    json_str = response[json_start:json_end]
                    parsed = json.loads(json_str)

                    # Validate required fields
                    required_fields = ['style_summary', 'characteristics', 'strengths', 'playing_patterns', 'improvement_focus']
                    if all(field in parsed for field in required_fields):
                        print("[AI] ✅ Successfully parsed style analysis response")
                        return parsed

                    print("[AI] ⚠️  Style analysis response missing required fields")

            # If JSON parsing failed, try to extract fields manually
            print("[AI] ⚠️  Could not parse JSON, attempting fallback parsing")

        except json.JSONDecodeError as e:
            print(f"[AI] ⚠️  JSON parsing error: {e}")
        except Exception as e:
            print(f"[AI] ⚠️  Error parsing style analysis: {e}")

        # Fallback: Return structured response with AI text in first field
        # This allows the system to still use the AI-generated content even if parsing fails
        return {
            'style_summary': response[:500] if len(response) > 500 else response,
            'characteristics': "See style summary for details.",
            'strengths': "See style summary for details.",
            'playing_patterns': "See style summary for details.",
            'improvement_focus': "See style summary for details."
        }
