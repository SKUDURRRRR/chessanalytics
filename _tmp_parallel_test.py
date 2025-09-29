import asyncio
from python.core.unified_api_server import _perform_batch_analysis

async def main():
    await _perform_batch_analysis('pyarelalbhukar', 'chess.com', 'stockfish', 5, 8, 8)

asyncio.run(main())
