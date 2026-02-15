# Changelog

All notable changes to the Chess Analytics project.

## Current State (February 2026)

### Platform
- React 18 + TypeScript 5.8 + Vite 7 frontend on Vercel
- Python FastAPI backend on Railway with Stockfish 17.1
- Supabase PostgreSQL database with Row Level Security
- Stripe payment integration with tiered subscriptions
- AI coaching comments via Google Gemini and Anthropic Claude

### Key Features
- Player search and game import from Lichess and Chess.com
- Stockfish-powered move-by-move analysis with chess.com-standard classifications
- 6-trait personality profiling (tactical, positional, aggressive, patient, novelty, staleness)
- Famous player style matching
- ELO trend graphs with accuracy overlay
- Opening repertoire analysis with color-specific stats
- Interactive game replay with arrow overlays and follow-up explorer
- Time management analysis
- Anonymous user rate limiting with 24-hour rolling window

### Recent Fixes
- Fixed production analytics data discrepancy (cache version v8)
- Fixed Enhanced Game Length Insights missing in production
- Implemented dual API calls: limit=10000 for color/opening stats, limit=100 for analysis data
- Fixed Coach Tal greeting messages and AI coaching comments
- Fixed opening identification to use actual moves instead of PGN headers
