"""
Structured logging configuration for the Chess Analytics backend.

Call setup_logging() early in server startup to configure all loggers.
Controlled by LOG_LEVEL env var (default: INFO).
"""

import logging
import os
import sys


def setup_logging() -> None:
    """Configure structured logging for the application."""
    log_level = os.getenv("LOG_LEVEL", "INFO").upper()
    numeric_level = getattr(logging, log_level, logging.INFO)

    # Format: timestamp - logger name - level - message
    formatter = logging.Formatter(
        fmt="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    # Configure root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(numeric_level)

    # Remove any existing handlers to avoid duplicates
    root_logger.handlers.clear()

    # Console handler (stderr for production log aggregation)
    handler = logging.StreamHandler(sys.stderr)
    handler.setLevel(numeric_level)
    handler.setFormatter(formatter)
    root_logger.addHandler(handler)

    # Suppress noisy third-party loggers
    for noisy_logger in ("urllib3", "httpcore", "httpx", "asyncio", "hpack", "charset_normalizer"):
        logging.getLogger(noisy_logger).setLevel(logging.WARNING)

    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
