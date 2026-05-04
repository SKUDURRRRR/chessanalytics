import logging

logger = logging.getLogger(__name__)

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

# Try to import Google Generative AI (Gemini), but make it optional
try:
    import google.generativeai as genai
    GEMINI_AVAILABLE = True
    logger.info(f"Google Generative AI package is available (version {genai.__version__})")
except ImportError as e:
    GEMINI_AVAILABLE = False
    genai = None  # type: ignore
    logger.info(f"Error importing google.generativeai: {e}")
except Exception as e:
    GEMINI_AVAILABLE = False
    genai = None  # type: ignore
    logger.info(f"Unexpected error importing google.generativeai: {e}")

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


class AIProvider(Enum):
    """AI provider options."""
    ANTHROPIC = "anthropic"
    GEMINI = "gemini"


class AIConfig(BaseSettings):
    """Configuration for AI comment generation.

    Supports multiple AI providers:
    - Anthropic (Claude): claude-3-haiku-20240307, claude-3-sonnet, etc.
    - Gemini: gemini-2.0-flash-exp, gemini-1.5-flash (recommended for cost-effectiveness)

    The system will automatically use the appropriate client based on AI_PROVIDER env var.
    """
    ai_provider: str = "gemini"  # Default provider: "anthropic" or "gemini"
    anthropic_api_key: Optional[str] = None
    gemini_api_key: Optional[str] = None
    ai_enabled: bool = True
    ai_model: str = "gemini-2.0-flash-exp"  # Default model (provider-specific)
    max_tokens: int = 120  # Keep comments concise (1-3 short sentences)
    temperature: float = 0.75  # Slightly reduced from 0.85 to reduce variability
    api_timeout: float = 30.0  # API call timeout in seconds
    rate_limit_delay: float = 2.0  # Delay between AI API calls in seconds

    def __init__(self, **kwargs):
        super().__init__(**kwargs)

        # Check for AI_PROVIDER from environment (without prefix)
        direct_provider = os.getenv("AI_PROVIDER")
        if direct_provider:
            self.ai_provider = direct_provider.lower()
            logger.info(f"Using AI_PROVIDER from environment: {self.ai_provider}")

        # Set provider-specific default model if not explicitly set
        if not os.getenv("AI_MODEL"):
            if self.ai_provider == AIProvider.GEMINI.value:
                self.ai_model = "gemini-2.0-flash-exp"
            elif self.ai_provider == AIProvider.ANTHROPIC.value:
                self.ai_model = "claude-haiku-4-5-20251001"

        # Manual override: Check for AI_MODEL (without double prefix)
        direct_model = os.getenv("AI_MODEL")
        if direct_model:
            self.ai_model = direct_model
            logger.info(f"Using AI_MODEL from environment: {direct_model}")

        # Check for API keys from environment (support both prefixed and non-prefixed)
        if not self.anthropic_api_key:
            self.anthropic_api_key = os.getenv("ANTHROPIC_API_KEY") or os.getenv("AI_ANTHROPIC_API_KEY")

        if not self.gemini_api_key:
            self.gemini_api_key = os.getenv("GEMINI_API_KEY") or os.getenv("AI_GEMINI_API_KEY") or os.getenv("GOOGLE_AI_API_KEY")

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
    Generates human-like chess comments using AI models from multiple providers.

    Supported providers:
    - Anthropic (Claude): claude-3-haiku, claude-3-sonnet, claude-3-5-sonnet
    - Gemini: gemini-2.0-flash-exp, gemini-1.5-flash (recommended for cost-effectiveness)

    Features automatic model fallback for Anthropic - if the configured model is unavailable,
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
        logger.info("Initializing AIChessCommentGenerator...")
        self.config = AIConfig()
        self.provider = self.config.ai_provider.lower()
        logger.info(f"Config loaded - Provider: {self.provider}, Model: {self.config.ai_model}, Enabled: {self.config.ai_enabled}")
        self.client = None
        self.enabled = False

        # Initialize chess knowledge retriever for enhanced teaching
        try:
            from .chess_knowledge_retriever import ChessKnowledgeRetriever
            self.knowledge_retriever = ChessKnowledgeRetriever()
            logger.info("Chess knowledge retriever initialized - enhanced teaching enabled")
        except Exception as e:
            logger.info(f"Could not initialize knowledge retriever: {e}")
            self.knowledge_retriever = None

        # Rate limiting: track last API call time to prevent overwhelming the API
        self._last_api_call_time = 0.0
        self._rate_limit_lock = threading.Lock()
        self._rate_limit_delay = self.config.rate_limit_delay

        # Async rate limiting: token bucket rate limiter for parallel calls
        # Provider-specific rate limits
        try:
            from .resilient_api_client import RateLimiter
            if self.provider == AIProvider.GEMINI.value:
                # Gemini limit: 15 requests per second (free tier)
                capacity = 15
                refill_rate = 15.0  # 15 requests per second
                max_concurrent = 10  # Lower for Gemini
                logger.info(f"Async rate limiter initialized for Gemini (15 req/sec, 10 concurrent)")
            else:
                # Anthropic limit: 50 requests per minute
                capacity = 50
                refill_rate = 50.0 / 60.0  # Refill at 50/60 requests per second
                max_concurrent = 15  # Max 15 concurrent calls
                logger.info(f"Async rate limiter initialized for Anthropic (50 req/min, 15 concurrent)")

            self._async_rate_limiter = RateLimiter(
                capacity=capacity,
                refill_rate=refill_rate
            )
            # Semaphore to limit concurrent API calls (prevent overwhelming)
            self._api_semaphore = asyncio.Semaphore(max_concurrent)
        except ImportError:
            self._async_rate_limiter = None
            self._api_semaphore = None
            logger.info("RateLimiter not available, async parallel calls disabled")

        # Initialize comment cache to avoid regenerating identical comments
        # Cache key: hash of (FEN + move + quality + ELO_range)
        # Cache size: 500 entries (common positions/moves)
        # TTL: 24 hours (comments don't change for same position)
        try:
            from .cache_manager import LRUCache
            self._comment_cache = LRUCache(maxsize=500, ttl=86400, name="ai_comment_cache")
            logger.info("Comment cache initialized (500 entries, 24h TTL)")
        except ImportError:
            # Fallback to simple dict if cache_manager not available
            self._comment_cache = {}
            logger.info("Cache manager not available, using simple dict cache")

        # Initialize provider-specific client
        if self.provider == AIProvider.GEMINI.value:
            self._init_gemini_client()
        else:
            # Default to Anthropic for backward compatibility
            self._init_anthropic_client()

    def _init_anthropic_client(self):
        """Initialize Anthropic (Claude) client."""
        # Check if Anthropic package is available
        if not ANTHROPIC_AVAILABLE:
            logger.warning("Warning: Anthropic package not installed. AI comments will be disabled.")
            logger.info("Install with: pip install anthropic>=0.18.0")
            return

        logger.info("Anthropic package is available")

        # Get API key
        api_key = self.config.anthropic_api_key
        if not api_key:
            logger.info("No Anthropic API key found, AI comments will be disabled")
            logger.info("Check your .env.local file for ANTHROPIC_API_KEY or AI_ANTHROPIC_API_KEY")
            return

        try:
            # Mask API key for logging
            masked_key = f"{api_key[:10]}...{api_key[-4:]}" if len(api_key) > 14 else "***"
            logger.info(f"Attempting to initialize Anthropic client with key: {masked_key}")
            logger.info(f"Model from config: {self.config.ai_model}")
            logger.info(f"AI_ENABLED from config: {self.config.ai_enabled}")
            logger.info(f"API timeout: {self.config.api_timeout}s")

            # Initialize Anthropic client with httpx timeout configuration
            try:
                import httpx
                timeout = httpx.Timeout(
                    connect=10.0,
                    read=self.config.api_timeout,
                    write=10.0,
                    pool=10.0
                )
                http_client = httpx.Client(timeout=timeout)
                try:
                    self.client = Anthropic(
                        api_key=api_key,
                        http_client=http_client,
                        max_retries=0
                    )
                except TypeError:
                    self.client = Anthropic(
                        api_key=api_key,
                        http_client=http_client
                    )
                logger.info(f"Anthropic client initialized with httpx timeout: {self.config.api_timeout}s, max_retries=0")
            except (ImportError, TypeError) as e:
                logger.info(f"Could not configure custom http_client: {e}")
                logger.info(f"Using default client (timeout may not be configurable)")
                try:
                    self.client = Anthropic(api_key=api_key, max_retries=0)
                except TypeError:
                    self.client = Anthropic(api_key=api_key)

            self.enabled = self.config.ai_enabled
            if self.enabled:
                logger.info(f"Anthropic client initialized successfully!")
                logger.info(f"Model: {self.config.ai_model}")
                logger.info(f"AI enabled: {self.enabled}")
                logger.info(f"Ready to generate comments with model: {self.config.ai_model}")
            else:
                logger.info(f"Anthropic client initialized but AI is disabled (AI_ENABLED={self.config.ai_enabled})")
                logger.info(f"Set AI_ENABLED=true in your .env file to enable AI comments")
        except Exception as e:
            logger.error(f"Warning: Failed to initialize Anthropic client: {e}")
            import traceback
            logger.info(f"Traceback: {traceback.format_exc()}")
            self.enabled = False

    def _init_gemini_client(self):
        """Initialize Google Gemini client."""
        # Check if Gemini package is available
        if not GEMINI_AVAILABLE:
            logger.warning("Warning: Google Generative AI package not installed. AI comments will be disabled.")
            logger.info("Install with: pip install google-generativeai>=0.8.0")
            return

        logger.info("Google Generative AI package is available")

        # Get API key
        api_key = self.config.gemini_api_key
        if not api_key:
            logger.info("No Gemini API key found, AI comments will be disabled")
            logger.info("Check your .env.local file for GEMINI_API_KEY, AI_GEMINI_API_KEY, or GOOGLE_AI_API_KEY")
            return

        try:
            # Mask API key for logging
            masked_key = f"{api_key[:10]}...{api_key[-4:]}" if len(api_key) > 14 else "***"
            logger.info(f"Attempting to initialize Gemini client with key: {masked_key}")
            logger.info(f"Model from config: {self.config.ai_model}")
            logger.info(f"AI_ENABLED from config: {self.config.ai_enabled}")
            logger.info(f"API timeout: {self.config.api_timeout}s")

            # Configure Gemini API
            genai.configure(api_key=api_key)

            # Initialize Gemini model
            self.client = genai.GenerativeModel(self.config.ai_model)

            self.enabled = self.config.ai_enabled
            if self.enabled:
                logger.info(f"Gemini client initialized successfully!")
                logger.info(f"Model: {self.config.ai_model}")
                logger.info(f"AI enabled: {self.enabled}")
                logger.info(f"Ready to generate comments with model: {self.config.ai_model}")
            else:
                logger.info(f"Gemini client initialized but AI is disabled (AI_ENABLED={self.config.ai_enabled})")
                logger.info(f"Set AI_ENABLED=true in your .env file to enable AI comments")
        except Exception as e:
            logger.error(f"Warning: Failed to initialize Gemini client: {e}")
            import traceback
            logger.info(f"Traceback: {traceback.format_exc()}")
            self.enabled = False

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
            logger.info("Generator is not enabled")
            return None

        if not self.client:
            logger.info("Anthropic client is not initialized")
            return None

        try:
            # Check cache first to avoid regenerating identical comments
            cache_key = self._generate_cache_key(move_analysis, board, move, is_user_move, player_elo)
            if hasattr(self._comment_cache, 'get'):
                cached_comment = self._comment_cache.get(cache_key)
                if cached_comment:
                    logger.info(f"✅ Cache hit! Reusing comment for {move_analysis.get('move_san', 'unknown')}")
                    return cached_comment
            elif isinstance(self._comment_cache, dict) and cache_key in self._comment_cache:
                cached_comment = self._comment_cache[cache_key]
                logger.info(f"✅ Cache hit! Reusing comment for {move_analysis.get('move_san', 'unknown')}")
                return cached_comment

            logger.info(f"Building prompt for move {move_analysis.get('move_san', 'unknown')}, ELO: {player_elo}")
            # Prepare prompt with move context
            prompt = self._build_prompt(move_analysis, board, move, is_user_move, player_elo)

            logger.info(f"Calling Anthropic API with model {self.config.ai_model}")
            # Simplified system prompt focused on technical/educational content
            base_system_prompt = """You are Mikhail Tal teaching chess. Your focus is on clear, educational explanations.

**YOUR TEACHING APPROACH:**
- Technical and educational - explain concepts clearly and specifically
- Focus on chess principles: tactics, strategy, pawn structure, piece activity
- Direct and professional - no flowery language or unnecessary interjections
- Grammatically correct and well-structured sentences
- Connect moves to fundamental chess concepts

**WHEN TEACHING:**
- For good moves: Explain the chess principles that make them strong
- For mistakes: Clearly identify what went wrong and suggest improvements
- For brilliant moves: Show enthusiasm and explain the tactical vision
- Always focus on helping players understand WHY moves work or fail

**CRITICAL: BE FACTUAL, NOT SPECULATIVE:**
- You have Stockfish engine analysis - use it to state FACTS, not guesses
- NEVER say "likely", "probably", "may have", "you might have" - you KNOW what happened
- State what the move actually does: "This loses a pawn" not "You likely lost material"
- Use the evaluation numbers and piece interactions provided to make definitive statements
- If the data shows a specific tactical issue (hanging piece, lost material, missed tactic), name it concretely

Write clear, educational comments that teach chess concepts."""

            if self.knowledge_retriever:
                system_prompt = self.knowledge_retriever.get_enhanced_system_prompt(
                    player_elo=player_elo,
                    base_prompt=base_system_prompt
                )
            else:
                system_prompt = base_system_prompt

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
                # Clean, ensure grammar consistency, and validate comment
                comment = self._clean_comment(comment, is_user_move, player_color)
                comment = self._ensure_grammar_consistency(comment)
                comment = self._validate_comment(comment, move_san, is_capture, is_user_move, captured_piece_name)
                logger.info(f"Generated comment ({len(comment)} chars): {comment[:100]}...")

                # Cache the comment for future use
                if hasattr(self._comment_cache, 'set'):
                    self._comment_cache.set(cache_key, comment)
                elif isinstance(self._comment_cache, dict):
                    self._comment_cache[cache_key] = comment

                return comment

            logger.info("Response had no content")
            return None

        except Exception as e:
            import traceback
            logger.info(f"Error generating AI comment: {e}")
            logger.info(f"Full traceback: {traceback.format_exc()}")
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
            logger.info("Async rate limiter not available, falling back to sync")
            return self.generate_comment(move_analysis, board, move, is_user_move, player_elo)

        try:
            # Check cache first (same as sync version)
            cache_key = self._generate_cache_key(move_analysis, board, move, is_user_move, player_elo)
            if hasattr(self._comment_cache, 'get'):
                cached_comment = self._comment_cache.get(cache_key)
                if cached_comment:
                    logger.info(f"✅ Cache hit! Reusing comment for {move_analysis.get('move_san', 'unknown')}")
                    return cached_comment
            elif isinstance(self._comment_cache, dict) and cache_key in self._comment_cache:
                cached_comment = self._comment_cache[cache_key]
                logger.info(f"✅ Cache hit! Reusing comment for {move_analysis.get('move_san', 'unknown')}")
                return cached_comment

            # Wait for rate limiter token (respects 50/minute limit, non-blocking)
            token_acquired = await self._async_rate_limiter.wait_for_token(tokens=1, timeout=30.0)
            if not token_acquired:
                logger.info(f"⚠️  Rate limiter timeout for {move_analysis.get('move_san', 'unknown')}, skipping AI comment")
                return None

            # Use semaphore to limit concurrent calls
            async with self._api_semaphore:
                logger.info(f"Building prompt for move {move_analysis.get('move_san', 'unknown')}, ELO: {player_elo}")
                prompt = self._build_prompt(move_analysis, board, move, is_user_move, player_elo)

                logger.info(f"Calling Anthropic API (async) with model {self.config.ai_model}")
                # Get enhanced system prompt with chess teaching methodology and Tal's authentic style
                base_system_prompt = """You are Mikhail Tal, the Magician from Riga. You teach chess with the energy and passion that made you a World Champion. Your style is direct, engaging, and enthusiastic-you see the beauty in tactics and the power in creative play.

**YOUR AUTHENTIC VOICE:**
- Be energetic and direct-show genuine excitement about chess
- Speak with confidence and clarity-you know what you're talking about
- Be passionate about tactics and creative possibilities
- Keep it real-no flowery language, just clear, engaging explanations
- Show enthusiasm for good moves and tactical opportunities
- Be encouraging but honest-celebrate brilliance, explain mistakes clearly

**YOUR TEACHING STYLE:**
- Explain chess concepts clearly and directly
- Connect moves to fundamental principles
- Show why tactics work-the logic behind combinations
- Help players see the possibilities in positions
- Encourage creative thinking and tactical awareness
- Build understanding through clear, concrete examples

Never start comments with 'Ah,' 'Oh,' or similar interjections-begin directly with your commentary. Write with the energy and insight that made you the Magician from Riga."""

                if self.knowledge_retriever:
                    system_prompt = self.knowledge_retriever.get_enhanced_system_prompt(
                        player_elo=player_elo,
                        base_prompt=base_system_prompt
                    )
                else:
                    system_prompt = base_system_prompt

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
                    # Clean, ensure grammar consistency, and validate comment
                    comment = self._clean_comment(comment, is_user_move, player_color)
                    comment = self._ensure_grammar_consistency(comment)
                    comment = self._validate_comment(comment, move_san, is_capture, is_user_move, captured_piece_name)
                    logger.info(f"Generated comment ({len(comment)} chars): {comment[:100]}...")

                    # Cache the comment
                    if hasattr(self._comment_cache, 'set'):
                        self._comment_cache.set(cache_key, comment)
                    elif isinstance(self._comment_cache, dict):
                        self._comment_cache[cache_key] = comment

                    return comment

            logger.info("Response had no content")
            return None

        except Exception as e:
            import traceback
            logger.info(f"Error generating AI comment (async): {e}")
            logger.info(f"Full traceback: {traceback.format_exc()}")
            return None

    async def _call_api_async(self, prompt: str, system: str) -> Optional[str]:
        """
        Async API call (provider-specific).
        Routes to appropriate async implementation based on provider.
        """
        if not self.enabled or not self.client:
            return None

        # Route to provider-specific async implementation
        if self.provider == AIProvider.GEMINI.value:
            return await self._call_gemini_api_async(prompt, system)
        else:
            return await self._call_anthropic_api_async(prompt, system)

    async def _call_anthropic_api_async(self, prompt: str, system: str) -> Optional[str]:
        """
        Async API call to Anthropic.
        Uses httpx.AsyncClient for non-blocking HTTP requests.
        """
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
                    logger.info(f"Rate limit exceeded (429), skipping AI comment")
                    return None
                else:
                    logger.info(f"API call failed with status {response.status_code}: {response.text}")
                    return None

        except Exception as e:
            logger.info(f"Error in async Anthropic API call: {e}")
            return None

    async def _call_gemini_api_async(self, prompt: str, system: str) -> Optional[str]:
        """
        Async API call to Gemini.
        Uses asyncio.to_thread to run synchronous Gemini calls in async context.
        """
        try:
            # Gemini SDK doesn't have native async, so we use asyncio.to_thread
            def _generate_sync():
                generation_config = {
                    "max_output_tokens": self.config.max_tokens,
                    "temperature": self.config.temperature,
                }

                return self.client.generate_content(
                    contents=[prompt],
                    system_instruction=system,
                    generation_config=generation_config
                )

            response = await asyncio.to_thread(_generate_sync)

            if response and hasattr(response, 'text'):
                return response.text.strip()
            else:
                logger.info(f"Response from Gemini had no text content")
                return None

        except Exception as e:
            error_msg = str(e)
            logger.error(f"Gemini async API call failed: {error_msg}")

            # Handle Gemini-specific errors
            if "429" in error_msg or "rate_limit" in error_msg.lower() or "quota" in error_msg.lower():
                logger.info(f"Rate limit/quota exceeded for Gemini. Skipping AI comment.")
            elif "timeout" in error_msg.lower() or "timed out" in error_msg.lower():
                logger.info(f"API call timeout for Gemini. Skipping to prevent blocking.")

            return None

    async def generate_chat_response(self, prompt: str, system_prompt: str) -> Optional[str]:
        """Generate a chat response using the configured AI provider.

        Public method for interactive coach chat. Uses the same underlying
        AI infrastructure as move comment generation.

        Args:
            prompt: The user prompt including position context and message.
            system_prompt: The system prompt with coaching instructions.

        Returns:
            The AI response text, or None if generation failed.
        """
        if not self.enabled:
            logger.info("Generator not enabled, skipping")
            return None
        if not self.client:
            logger.info("No client initialized, skipping")
            return None

        logger.info(f"Generating response via {self.provider}...")

        try:
            # Apply rate limiting
            if self._async_rate_limiter:
                acquired = await self._async_rate_limiter.wait_for_token(timeout=10.0)
                if not acquired:
                    logger.info("Rate limit: could not acquire token")
                    return None

            # For chat, use a dedicated Gemini call that handles system_instruction
            # via model instantiation (some SDK versions don't support it per-call)
            result = None
            if self._api_semaphore:
                async with self._api_semaphore:
                    result = await self._call_chat_api_async(prompt, system_prompt)
            else:
                result = await self._call_chat_api_async(prompt, system_prompt)

            if result:
                logger.info(f"Got response ({len(result)} chars)")
            else:
                logger.info("API returned None")
            return result

        except Exception as e:
            logger.info(f"Error generating chat response: {e}")
            import traceback
            traceback.print_exc()
            return None

    async def _call_chat_api_async(self, prompt: str, system_prompt: str) -> Optional[str]:
        """Async API call for chat, handling system_instruction correctly per provider."""
        if self.provider == AIProvider.GEMINI.value:
            return await self._call_gemini_chat_async(prompt, system_prompt)
        else:
            # Anthropic handles system prompt fine in _call_anthropic_api_async
            # but we override max_tokens for chat
            original_max = self.config.max_tokens
            self.config.max_tokens = 1024
            try:
                return await self._call_anthropic_api_async(prompt, system_prompt)
            finally:
                self.config.max_tokens = original_max

    async def _call_gemini_chat_async(self, prompt: str, system_prompt: str) -> Optional[str]:
        """Gemini chat call - creates model with system_instruction at init time."""
        try:
            def _generate_sync():
                # Create a model instance with system_instruction baked in
                chat_model = genai.GenerativeModel(
                    self.config.ai_model,
                    system_instruction=system_prompt,
                )
                generation_config = {
                    "max_output_tokens": 1024,
                    "temperature": 0.8,
                }
                return chat_model.generate_content(
                    contents=[prompt],
                    generation_config=generation_config,
                )

            response = await asyncio.to_thread(_generate_sync)

            if response and response.candidates:
                candidate = response.candidates[0]
                finish_reason = getattr(candidate, 'finish_reason', None)
                logger.info(f"Gemini finish_reason={finish_reason}")
                if finish_reason and str(finish_reason) not in ('1', 'STOP', 'FinishReason.STOP'):
                    logger.warning(f"Warning: non-STOP finish reason: {finish_reason}")
                if hasattr(response, 'text') and response.text:
                    return response.text.strip()
                # Try extracting from candidate parts if .text fails
                if candidate.content and candidate.content.parts:
                    text = ''.join(p.text for p in candidate.content.parts if hasattr(p, 'text'))
                    if text:
                        return text.strip()
            logger.info("Gemini response had no text content")
            return None

        except Exception as e:
            logger.error(f"Gemini API call failed: {e}")
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

    def _validate_piece_references(self, comment: str, board: chess.Board) -> str:
        """
        Validate piece+square references in the comment against actual board state.
        Removes or generalizes references to pieces that don't exist at the stated squares.
        """
        if not comment or not board:
            return comment

        piece_names_map = {
            'pawn': chess.PAWN, 'knight': chess.KNIGHT, 'bishop': chess.BISHOP,
            'rook': chess.ROOK, 'queen': chess.QUEEN, 'king': chess.KING
        }

        # Pattern to match "piece on square" references
        # e.g., "knight on d4", "the bishop on e5", "White's rook on a1"
        pattern = r'\b(white\'?s?|black\'?s?)?\s*(pawn|knight|bishop|rook|queen|king)\s+on\s+([a-h][1-8])\b'

        def validate_reference(match):
            """Check if the piece reference is valid, return original or empty string."""
            full_match = match.group(0)
            color_str = match.group(1) or ''
            piece_type_str = match.group(2).lower()
            square_str = match.group(3).lower()

            try:
                square = chess.parse_square(square_str)
                piece = board.piece_at(square)

                if piece is None:
                    # No piece at this square - remove the reference
                    logger.info(f"❌ Hallucination detected: '{full_match}' - no piece on {square_str}")
                    return ""

                expected_piece_type = piece_names_map.get(piece_type_str)
                if expected_piece_type and piece.piece_type != expected_piece_type:
                    # Wrong piece type at this square
                    actual_piece_name = {
                        chess.PAWN: 'pawn', chess.KNIGHT: 'knight', chess.BISHOP: 'bishop',
                        chess.ROOK: 'rook', chess.QUEEN: 'queen', chess.KING: 'king'
                    }.get(piece.piece_type, 'piece')
                    logger.info(f"❌ Wrong piece: '{full_match}' - actually a {actual_piece_name} on {square_str}")
                    return ""

                # Check color if specified
                if color_str:
                    is_white_ref = 'white' in color_str.lower()
                    is_black_ref = 'black' in color_str.lower()
                    if is_white_ref and piece.color != chess.WHITE:
                        logger.info(f"❌ Wrong color: '{full_match}' - piece is Black")
                        return ""
                    if is_black_ref and piece.color != chess.BLACK:
                        logger.info(f"❌ Wrong color: '{full_match}' - piece is White")
                        return ""

                # Reference is valid
                return full_match

            except Exception as e:
                logger.warning(f"Warning: Could not validate '{full_match}': {e}")
                return full_match

        # Apply validation
        validated_comment = re.sub(pattern, validate_reference, comment, flags=re.IGNORECASE)

        # Clean up any double spaces or orphaned punctuation from removals
        validated_comment = re.sub(r'\s+', ' ', validated_comment)
        validated_comment = re.sub(r'\s+([,.])', r'\1', validated_comment)
        validated_comment = re.sub(r'([,.])\s*([,.])', r'\1', validated_comment)
        validated_comment = validated_comment.strip()

        return validated_comment

    def _validate_comment(self, comment: str, move_san: str, is_capture: bool,
                          is_user_move: bool, captured_piece: Optional[str] = None,
                          board: chess.Board = None) -> str:
        """Validate and fix common AI hallucination patterns."""
        if not comment:
            return comment

        # First, validate piece references against actual board state
        if board:
            comment = self._validate_piece_references(comment, board)

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

        # Catch-all: auto-conjugate remaining "you [verb]" patterns
        # Handles verbs not in the explicit mapping above
        _non_verbs = {'the', 'a', 'an', 'this', 'that', 'can', 'could', 'would', 'should', 'will',
                      'might', 'may', 'must', 'also', 'still', 'just', 'only', 'never', 'always',
                      'already', 'now', 'then', 'too', 'even', 'need', 'want', 'get', 'had', 'did', 'do'}
        def _auto_conjugate(match):
            word = match.group(1)
            if word.lower() in _non_verbs:
                return f'{color_name} {word}'
            # Basic English third-person conjugation
            wl = word.lower()
            if wl.endswith(('s', 'sh', 'ch', 'x', 'z')):
                return f'{color_name} {word}es'
            elif wl.endswith('y') and len(wl) > 1 and wl[-2] not in 'aeiou':
                return f'{color_name} {word[:-1]}ies'
            else:
                return f'{color_name} {word}s'

        comment = re.sub(r'\byou\s+([a-z]\w+)', _auto_conjugate, comment, flags=re.IGNORECASE)

        # Replace remaining standalone "you" with color name
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

        # Limit sentences: allow 4 for complex tactical positions, 3 otherwise
        comment_text = " ".join(complete_sentences).lower()
        tactical_keywords = ('checkmate', 'sacrifice', 'combination', 'tactical', 'forcing', 'blunder', 'mate')
        max_sentences = 4 if any(kw in comment_text for kw in tactical_keywords) else 3
        if len(complete_sentences) > max_sentences:
            complete_sentences = complete_sentences[:max_sentences]

        comment = " ".join(complete_sentences)

        # Ensure it ends with proper punctuation
        if comment and not comment.endswith(('.', '!', '?')):
            comment += "."

        # Fix comments that start with "'s move" (missing color name)
        # This can happen if the AI generates malformed text or if replacement logic fails
        if comment and comment.strip().startswith("'s move"):
            # Add the color name at the beginning
            comment = f"{color_name}'s move" + comment[7:]  # Remove "'s move" and add "{color_name}'s move"
        elif comment and comment.strip().startswith("'s "):
            # Handle other cases where "'s " appears at the start
            comment = f"{color_name}'s " + comment[3:]  # Remove "'s " and add "{color_name}'s "

        return comment.strip()

    def _ensure_grammar_consistency(self, comment: str) -> str:
        """
        Ensure grammatical consistency and proper formatting.
        Post-processing to fix common AI quirks and ensure professional output.

        Args:
            comment: The comment to process

        Returns:
            Grammatically consistent comment
        """
        if not comment:
            return comment

        comment = comment.strip()

        # Capitalize first letter
        if comment and comment[0].islower():
            comment = comment[0].upper() + comment[1:]

        # Ensure proper punctuation at end
        if comment and not comment.endswith(('.', '!', '?')):
            comment += '.'

        # Fix common spacing issues
        comment = re.sub(r'\s+', ' ', comment)  # Multiple spaces to single space
        comment = re.sub(r'\s+([.,!?])', r'\1', comment)  # Remove space before punctuation
        comment = re.sub(r'([.,!?])([A-Za-z])', r'\1 \2', comment)  # Add space after punctuation if missing

        # Ensure consistent capitalization of chess terms
        # "white" and "black" should be capitalized when referring to players
        comment = re.sub(r'\bwhite\b', 'White', comment)
        comment = re.sub(r'\bblack\b', 'Black', comment)

        # Fix double periods
        comment = re.sub(r'\.\.+', '.', comment)

        # Remove redundant spaces around dashes
        comment = re.sub(r'\s*-\s*', ' - ', comment)

        # Fix "White's's" or "Black's's" (double possessive)
        comment = re.sub(r"(White|Black)'s's", r"\1's", comment)

        # Ensure no trailing spaces before final punctuation
        comment = comment.strip()

        return comment

    def _call_api_with_fallback(
        self,
        prompt: str,
        system: str,
        max_tokens: int = None,
        temperature: float = None
    ) -> Optional[str]:
        """
        Call AI API with automatic fallback (provider-specific).
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
                logger.info(f"Rate limiting: waiting {sleep_time:.2f}s before API call")
                time.sleep(sleep_time)
            self._last_api_call_time = time.time()

        max_tokens = max_tokens or self.config.max_tokens
        temperature = temperature if temperature is not None else self.config.temperature

        # Route to provider-specific implementation
        if self.provider == AIProvider.GEMINI.value:
            return self._call_gemini_api(prompt, system, max_tokens, temperature)
        else:
            return self._call_anthropic_api(prompt, system, max_tokens, temperature)

    def _call_gemini_api(
        self,
        prompt: str,
        system: str,
        max_tokens: int,
        temperature: float
    ) -> Optional[str]:
        """
        Call Gemini API with the configured model.

        Args:
            prompt: The user prompt
            system: The system prompt (used as system_instruction for Gemini)
            max_tokens: Maximum tokens (max_output_tokens for Gemini)
            temperature: Temperature

        Returns:
            Generated text or None if failed
        """
        try:
            logger.info(f"Attempting Gemini API call with model: {self.config.ai_model}")

            generation_config = {
                "max_output_tokens": max_tokens,
                "temperature": temperature,
            }

            # Use system_instruction for Gemini
            response = self.client.generate_content(
                contents=[prompt],
                system_instruction=system,
                generation_config=generation_config
            )

            if response and hasattr(response, 'text'):
                return response.text.strip()
            else:
                logger.info(f"Response from Gemini had no text content")
                return None

        except Exception as e:
            error_msg = str(e)
            logger.error(f"Gemini API call failed: {error_msg}")

            # Handle Gemini-specific errors
            if "429" in error_msg or "rate_limit" in error_msg.lower() or "quota" in error_msg.lower():
                logger.info(f"Rate limit/quota exceeded for Gemini. Skipping AI comment.")
            elif "timeout" in error_msg.lower() or "timed out" in error_msg.lower():
                logger.info(f"API call timeout for Gemini. Skipping to prevent blocking.")
            else:
                logger.info(f"Please check your Gemini API key and account status.")

            return None

    def _call_anthropic_api(
        self,
        prompt: str,
        system: str,
        max_tokens: int,
        temperature: float
    ) -> Optional[str]:
        """
        Call Anthropic API with automatic model fallback on 404 errors.

        Args:
            prompt: The user prompt
            system: The system prompt
            max_tokens: Maximum tokens
            temperature: Temperature

        Returns:
            Generated text or None if all attempts failed
        """

        # List of models to try (in order of preference)
        # Known working models that should be available to all API keys
        known_working_models = [
            "claude-haiku-4-5-20251001",   # Claude 4.5 Haiku (fastest, cheapest)
            "claude-sonnet-4-6-20250514",  # Claude 4.6 Sonnet (reliable fallback)
        ]

        # Models that may not be available to all API keys
        optional_models = [
            "claude-opus-4-6-20250514",    # Claude 4.6 Opus (best quality)
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
                logger.info(f"Attempting API call with model: {model} (timeout: {self.config.api_timeout}s)")

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
                    logger.info(f"⚠️  Empty response from model {model}")
                    continue

                if response.content and len(response.content) > 0:
                    comment = response.content[0].text.strip()
                    if model != self.config.ai_model:
                        logger.info(f"✅ Successfully generated using model: {model} (configured model was {self.config.ai_model})")
                        logger.info(f"💡 Update your .env.local: AI_MODEL={model}")
                    return comment
                else:
                    logger.info(f"⚠️  Response from {model} had no content")
                    continue

            except Exception as e:
                error_msg = str(e)
                last_error = e

                # Check for timeout errors - fail fast to prevent blocking
                if "timeout" in error_msg.lower() or "timed out" in error_msg.lower():
                    logger.info(f"⚠️  API call timeout ({self.config.api_timeout}s) for model {model}. Skipping to prevent blocking analysis.")
                    logger.info(f"💡 This is expected if API is slow. Analysis will continue with template comments.")
                    # Don't try other models if we're timing out - likely API issue
                    break

                # If it's a 404 (model not found), try next model immediately (no need to wait)
                if "404" in error_msg or "not_found" in error_msg.lower():
                    if model == self.config.ai_model:
                        logger.info(f"❌ Model {model} not found (404). Trying alternatives...")
                    else:
                        logger.info(f"Model {model} also not found (404). Trying next...")
                    continue
                elif "429" in error_msg or "rate_limit" in error_msg.lower() or "too many requests" in error_msg.lower():
                    # Rate limit error - fail fast to prevent blocking
                    logger.info(f"⚠️  Rate limit exceeded (429) for model {model}. Skipping AI comment to prevent blocking analysis.")
                    logger.info(f"💡 Analysis will continue with template comments. This is expected when analyzing many games.")
                    # Don't try other models if we're rate limited - likely too many concurrent requests
                    break
                else:
                    # For other errors, log but continue trying
                    logger.error(f"Model {model} failed with error: {error_msg}")
                    continue

        # All models failed
        logger.info(f"❌ All model attempts failed.")
        if last_error:
            logger.error(f"Last error: {last_error}")
        logger.info(f"Please check:")
        logger.info(f"1. Your API key has access to Claude models")
        logger.info(f"2. Your Anthropic account is active")
        logger.info(f"3. Try logging into console.anthropic.com to verify access")
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
                        logger.info(f"board_before shows piece on {chess.square_name(move.to_square)} but move_san '{move_san}' has no 'x' - possible board corruption")
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
                        logger.info(f"{move_san} captures {color} {piece_name} on {chess.square_name(move.to_square)}")

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
                        logger.info(f"CAPTURE INFO for {move_san}: captures {color} {piece_name} on {chess.square_name(move.to_square)}")
                else:
                    # Explicitly state when it's NOT a capture to prevent AI hallucination
                    capture_info = f"""
**NO CAPTURE IN THIS MOVE:**
- This move ({move_san}) does NOT capture any piece
- Do NOT mention captures, sacrifices, or material exchanges
- Focus on the move's positional or tactical purpose"""
            except Exception as e:
                logger.warning(f"Warning: Could not extract capture info: {e}")

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
            style_intensity = "highly analytical-explain the tactical and positional reasoning clearly, teach why this matters"
        elif move_quality in [MoveQuality.MISTAKE, MoveQuality.EXCELLENT]:
            style_intensity = "strong analytical focus-explain principles and patterns, what works and why"
        else:
            style_intensity = "teaching-focused-explain the chess principles clearly, build understanding"

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

        # Build MOVE CONTEXT - focused information about what the move did
        # This replaces the verbose "all pieces" approach with targeted context
        board_state_context = ""
        if board and move:
            try:
                piece_names_map = {
                    chess.PAWN: "pawn", chess.KNIGHT: "knight", chess.BISHOP: "bishop",
                    chess.ROOK: "rook", chess.QUEEN: "queen", chess.KING: "king"
                }

                # Get the piece that moved (from board_after, since the piece is now on the destination)
                moved_piece = board.piece_at(move.to_square)
                from_square = chess.square_name(move.from_square)
                to_square = chess.square_name(move.to_square)

                if moved_piece:
                    piece_name = piece_names_map.get(moved_piece.piece_type, "piece")
                    piece_color = "White" if moved_piece.color == chess.WHITE else "Black"

                    board_state_context = f"\n**THE MOVE: {piece_color} {piece_name} moved from {from_square} to {to_square}**\n"

                    # Add capture info if applicable (from capture_info already built above)
                    if is_capture and captured_piece_name:
                        board_state_context += f"- This move CAPTURED: {captured_piece_name}\n"

                    # Find key nearby pieces (on squares attacked by or attacking the moved piece)
                    key_pieces = []

                    # Get squares attacked by the moved piece
                    attacked_squares = board.attacks(move.to_square)
                    for sq in attacked_squares:
                        target_piece = board.piece_at(sq)
                        if target_piece and target_piece.color != moved_piece.color:
                            target_name = piece_names_map.get(target_piece.piece_type, "piece")
                            target_color = "White" if target_piece.color == chess.WHITE else "Black"
                            key_pieces.append(f"{piece_color} {piece_name} on {to_square} now attacks {target_color} {target_name} on {chess.square_name(sq)}")

                    # Get pieces attacking the moved piece's new square
                    attackers = board.attackers(not moved_piece.color, move.to_square)
                    for sq in attackers:
                        attacker = board.piece_at(sq)
                        if attacker:
                            attacker_name = piece_names_map.get(attacker.piece_type, "piece")
                            attacker_color = "White" if attacker.color == chess.WHITE else "Black"
                            key_pieces.append(f"{attacker_color} {attacker_name} on {chess.square_name(sq)} attacks {piece_color} {piece_name} on {to_square}")

                    if key_pieces:
                        board_state_context += "\n**KEY INTERACTIONS:**\n"
                        for kp in key_pieces[:5]:  # Limit to 5 most relevant
                            board_state_context += f"- {kp}\n"

                    # Add both kings' positions (always relevant)
                    for color in [chess.WHITE, chess.BLACK]:
                        king_sq = board.king(color)
                        if king_sq is not None:
                            king_color = "White" if color == chess.WHITE else "Black"
                            board_state_context += f"- {king_color} King is on {chess.square_name(king_sq)}\n"

                    # Check if move gives check
                    if board.is_check():
                        board_state_context += f"- This move gives CHECK!\n"

                    board_state_context += f"\n**ACCURACY RULE:** Only describe what actually happened with this move. Do not invent piece positions.\n"

            except Exception as e:
                # Could not generate board state context - continue without it
                logger.warning(f"Warning: Could not build move context: {e}")

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
                            except Exception:
                                break

                    if pv_san:
                        pv_line = " ".join(pv_san)
                        stockfish_context += f"- Best continuation (Principal Variation): {pv_line}\n"
                        stockfish_context += f"  (This shows Stockfish's calculated best line from this position)\n"
                except Exception as e:
                    logger.warning(f"Warning: Could not convert PV to SAN: {e}")

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
Write ONE short, encouraging sentence (maximum 15 words) that captures the excitement of starting a game. Channel Mikhail Tal's direct, energetic spirit. Be brief, enthusiastic, and real-something like "The game begins!" or "Time to play!" Keep it light and encouraging, not technical or flowery.

**CRITICAL RULES:**
- ONE sentence maximum, 15 words or less
- Be direct and energetic, like Tal-genuine enthusiasm, not poetry
- NO technical explanations, NO long descriptions, NO flowery language
- {"Just cheer them on for starting the game!" if is_user_move else "Acknowledge the game beginning with enthusiasm!"}

Write the comment now:"""
                return prompt

        # Get player color from move analysis
        player_color = move_analysis.get('player_color', 'white')

        # Retrieve relevant chess knowledge for enhanced teaching
        chess_knowledge = ""
        if self.knowledge_retriever:
            try:
                chess_knowledge = self.knowledge_retriever.retrieve_relevant_knowledge(
                    move_analysis=move_analysis,
                    board=board,
                    move=move,
                    game_phase=game_phase,
                    player_elo=player_elo
                )

                # Validate knowledge quality
                if chess_knowledge and len(chess_knowledge) > 20:
                    logger.info(f"✅ Retrieved chess knowledge ({len(chess_knowledge)} chars)")
                elif not chess_knowledge or len(chess_knowledge) < 20:
                    # Fallback: If no useful knowledge detected but move is poor quality, add common mistakes
                    if move_quality in [MoveQuality.MISTAKE, MoveQuality.BLUNDER, MoveQuality.INACCURACY]:
                        logger.info(f"⚠️  Limited knowledge retrieved for {move_quality.value} move, adding common mistakes context")
                        skill_level = self.knowledge_retriever.knowledge_base.get_skill_level_from_elo(player_elo)
                        common_mistakes = self.knowledge_retriever.knowledge_base.get_common_mistakes_context(
                            move_quality.value,
                            skill_level
                        )
                        if common_mistakes:
                            chess_knowledge = self.knowledge_retriever.knowledge_base.format_condensed_knowledge(
                                common_mistakes=common_mistakes,
                                max_chars=200
                            )
                            logger.info(f"✅ Added common mistakes fallback knowledge ({len(chess_knowledge)} chars)")
                    else:
                        logger.info(f"⚠️  No relevant knowledge detected for this position")

            except Exception as e:
                logger.info(f"⚠️  Could not retrieve chess knowledge: {e}")
                chess_knowledge = ""

        # Route to appropriate prompt builder based on move type
        if not is_user_move:
            return self._build_opponent_move_prompt(
                move_san, move_number, player_elo, complexity, game_phase,
                opening_context, previous_move_context, capture_info, is_capture,
                move_quality, eval_verb, eval_description, eval_explanation,
                board_state_context, stockfish_context, hanging_pieces_context, tactical_context, positional_context,
                fen_after, best_move_san, tal_style, player_color, chess_knowledge
            )
        else:
            return self._build_user_move_prompt(
                move_san, move_number, player_elo, complexity, game_phase,
                opening_context, previous_move_context, capture_info, is_capture,
                move_quality, eval_verb, eval_description, eval_explanation,
                board_state_context, stockfish_context, hanging_pieces_context, tactical_context, positional_context,
                fen_after, best_move_san, tal_style, player_color, chess_knowledge
            )

    def _build_opponent_move_prompt(
        self, move_san: str, move_number: int, player_elo: int, complexity: str,
        game_phase: str, opening_context: str, previous_move_context: str,
        capture_info: str, is_capture: bool, move_quality: MoveQuality,
        eval_verb: str, eval_description: str, eval_explanation: str,
        board_state_context: str, stockfish_context: str, hanging_pieces_context: str, tactical_context: str, positional_context: str,
        fen_after: str, best_move_san: str, tal_style: str, player_color: str, chess_knowledge: str = ""
    ) -> str:
        """Build simplified prompt for opponent moves - analyze what opponent did."""
        color_name = player_color.capitalize()  # "White" or "Black"

        # Task description and length constraint based on move quality
        if move_quality == MoveQuality.BRILLIANT:
            task_focus = "Explain why this brilliant move is strong."
            length_rule = "Write exactly 2-3 SHORT sentences (max 40 words total)."
        elif move_quality == MoveQuality.BLUNDER:
            task_focus = "Explain what went wrong and suggest a better move."
            length_rule = "Write exactly 2-3 SHORT sentences (max 40 words total)."
        elif move_quality in [MoveQuality.MISTAKE, MoveQuality.INACCURACY]:
            task_focus = "Explain what went wrong and suggest a better move."
            length_rule = "Write exactly 2 SHORT sentences (max 30 words total)."
        else:
            task_focus = "Explain the purpose behind this move."
            length_rule = "Write exactly 1-2 SHORT sentences (max 25 words total)."

        # Build condensed context (only essential information)
        context_parts = []

        # Include FEN so the AI can see the actual position
        if fen_after:
            context_parts.append(f"**POSITION (FEN after move):** {fen_after}")

        # CRITICAL: Include condensed board state to prevent hallucinations
        if board_state_context:
            context_parts.append(board_state_context[:500])  # Limit to 500 chars but keep it

        if capture_info:
            context_parts.append(capture_info)
        if hanging_pieces_context:
            context_parts.append(hanging_pieces_context)
        if stockfish_context:
            context_parts.append(stockfish_context)
        if tactical_context:
            context_parts.append(tactical_context)
        if positional_context:
            context_parts.append(positional_context)
        if opening_context:
            context_parts.append(opening_context)
        if previous_move_context:
            context_parts.append(previous_move_context)
        if chess_knowledge:
            context_parts.append(f"**CHESS CONCEPTS:** {chess_knowledge}")

        context = "\n".join(context_parts) if context_parts else ""

        # Evaluation context for calibrating severity
        eval_line = f"\nThis move {eval_verb} {eval_description}. {eval_explanation}" if eval_verb else ""

        # Better move suggestion
        better_move = f"\nSuggest {best_move_san} as better alternative." if best_move_san and move_quality in [MoveQuality.MISTAKE, MoveQuality.BLUNDER, MoveQuality.INACCURACY] else ""

        prompt = f"""CONTEXT: {color_name} (rated {player_elo}) just played {move_san} in the {game_phase} (move {move_number}). Move classified as: {move_quality.value}.{eval_line}
{context}

TASK: {length_rule} {task_focus}
Do NOT mention the player's rating.{better_move}

RULES:
- BREVITY IS CRITICAL - do NOT exceed the word limit above
- Start directly with chess analysis
- ONLY mention pieces listed in ACTUAL BOARD STATE above
- Refer to the player as "{color_name}" (never "Player {player_elo}" or "the player")
- Match severity to classification: "{move_quality.value}" - do NOT exaggerate
- NEVER hedge with "likely", "probably", "may have" - state facts
"""

        return prompt

    def _build_user_move_prompt(
        self, move_san: str, move_number: int, player_elo: int, complexity: str,
        game_phase: str, opening_context: str, previous_move_context: str,
        capture_info: str, is_capture: bool, move_quality: MoveQuality,
        eval_verb: str, eval_description: str, eval_explanation: str,
        board_state_context: str, stockfish_context: str, hanging_pieces_context: str, tactical_context: str, positional_context: str,
        fen_after: str, best_move_san: str, tal_style: str, player_color: str, chess_knowledge: str = ""
    ) -> str:
        """Build simplified prompt for user moves - explain the principle and idea behind the move."""
        color_name = player_color.capitalize()  # "White" or "Black"

        # Task description and length constraint based on move quality
        if move_quality == MoveQuality.BRILLIANT:
            task_focus = "Explain the tactical vision behind this brilliant move."
            length_rule = "Write exactly 2-3 SHORT sentences (max 40 words total)."
        elif move_quality == MoveQuality.BLUNDER:
            task_focus = "Explain what went wrong and what should be played instead."
            length_rule = "Write exactly 2-3 SHORT sentences (max 40 words total)."
        elif move_quality in [MoveQuality.MISTAKE, MoveQuality.INACCURACY]:
            task_focus = "Explain what went wrong and what should be played instead."
            length_rule = "Write exactly 2 SHORT sentences (max 30 words total)."
        else:
            task_focus = "Explain the chess principle behind this move."
            length_rule = "Write exactly 1-2 SHORT sentences (max 25 words total)."

        # Build condensed context (only essential information)
        context_parts = []

        # Include FEN so the AI can see the actual position
        if fen_after:
            context_parts.append(f"**POSITION (FEN after move):** {fen_after}")

        # CRITICAL: Include condensed board state to prevent hallucinations
        if board_state_context:
            context_parts.append(board_state_context[:500])  # Limit to 500 chars but keep it

        if capture_info:
            context_parts.append(capture_info)
        if hanging_pieces_context:
            context_parts.append(hanging_pieces_context)
        if stockfish_context:
            context_parts.append(stockfish_context)
        if tactical_context:
            context_parts.append(tactical_context)
        if positional_context:
            context_parts.append(positional_context)
        if opening_context:
            context_parts.append(opening_context)
        if previous_move_context:
            context_parts.append(previous_move_context)
        if chess_knowledge:
            context_parts.append(f"**CHESS CONCEPTS:** {chess_knowledge}")

        context = "\n".join(context_parts) if context_parts else ""

        # Evaluation context for calibrating severity
        eval_line = f"\nThis move {eval_verb} {eval_description}. {eval_explanation}" if eval_verb else ""

        # Better move suggestion
        better_move = f"\nSuggest {best_move_san} as better alternative." if best_move_san and move_quality in [MoveQuality.MISTAKE, MoveQuality.BLUNDER, MoveQuality.INACCURACY] else ""

        prompt = f"""CONTEXT: {color_name} (rated {player_elo}) just played {move_san} in the {game_phase} (move {move_number}). Move classified as: {move_quality.value}.{eval_line}
{context}

TASK: {length_rule} {task_focus}
Do NOT mention the player's rating.{better_move}

RULES:
- BREVITY IS CRITICAL - do NOT exceed the word limit above
- Start directly with chess analysis
- ONLY mention pieces listed in ACTUAL BOARD STATE above
- Refer to the player as "{color_name}" (never "Player {player_elo}" or "the player")
- Match severity to classification: "{move_quality.value}" - do NOT exaggerate
- NEVER hedge with "likely", "probably", "may have" - state facts
"""

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
            logger.info("Generator is not enabled for style analysis")
            return None

        if not self.client:
            logger.info("Anthropic client is not initialized for style analysis")
            return None

        try:
            logger.info(f"Generating style analysis for {player_level} player with {total_games} games")

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

            logger.info("Style analysis response had no content")
            return None

        except Exception as e:
            import traceback
            logger.info(f"Error generating style analysis: {e}")
            logger.info(f"Full traceback: {traceback.format_exc()}")
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
                        logger.info("✅ Successfully parsed style analysis response")
                        return parsed

                    logger.info("⚠️  Style analysis response missing required fields")

            # If JSON parsing failed, try to extract fields manually
            logger.info("⚠️  Could not parse JSON, attempting fallback parsing")

        except json.JSONDecodeError as e:
            logger.error(f"⚠️  JSON parsing error: {e}")
        except Exception as e:
            logger.info(f"⚠️  Error parsing style analysis: {e}")

        # Fallback: Return structured response with AI text in first field
        # This allows the system to still use the AI-generated content even if parsing fails
        return {
            'style_summary': response[:500] if len(response) > 500 else response,
            'characteristics': "See style summary for details.",
            'strengths': "See style summary for details.",
            'playing_patterns': "See style summary for details.",
            'improvement_focus': "See style summary for details."
        }
