# Chess Analytics - AI Agent Instructions

## Project Overview

This is a chess analytics platform built with React (frontend), Python FastAPI (backend), and Supabase (database). It provides player analysis, game insights, and personality scoring.

Key components:
- Frontend: TypeScript + React + Tailwind CSS
- Backend: Python FastAPI + Stockfish chess engine
- Database: PostgreSQL (Supabase) with 4 main tables
- External: Integration with Lichess and Chess.com APIs

## Critical Architecture Patterns

### Data Flow
```
Frontend → Services → Supabase/Python Backend → External APIs
```
Example: Player search in `src/components/simple/PlayerSearch.tsx` flows through:
1. `AutoImportService` → Fetch games from Lichess/Chess.com
2. `AnalysisService` → Process with Python backend
3. Store in Supabase tables → Display results

### Component Structure
- Simple components (`src/components/simple/`) - Core analytics
- Deep components (`src/components/deep/`) - Advanced analysis
- Each analytics feature follows: Search → Import → Analyze → Display

### Database Schema
Four core tables with relationships:
- `games` - Core chess game data
- `user_profiles` - User profile management 
- `game_analyses` - Analysis results
- `game_features` - Detailed game feature extraction

## Development Workflow

### Setting Up
```bash
# 1. Install dependencies
npm install
cd python && pip install -r requirements.txt

# 2. Configure environment
cp env.example .env  # Edit with your Supabase credentials

# 3. Start backend (required for deep analysis)
./start-backend.ps1
```

### Testing
- Run health check: `npm test`
- Test contracts: `npm run test:contract`
- Test frontend: `npm run test:fe`
- Test imports: `npm run test:import`

### Common Patterns

1. **Error Handling**
   - Use `ErrorBoundary` for React components
   - Backend errors structured as `{ success: boolean, message: string }`
   - See `src/components/ErrorBoundary.tsx` for example

2. **Analytics Components**
   - Import data through service layer
   - Handle loading/error states
   - Use TypeScript interfaces
   Example:
   ```tsx
   import { AnalysisService } from '../services/analysisService'
   import { ErrorBoundary } from '../components/ErrorBoundary'
   ```

3. **Data Validation**
   - Frontend: Zod schemas (see `src/services/simpleAnalytics.ts`)
   - Backend: Pydantic models
   - Database: RLS policies and constraints

## Project-Specific Conventions

### Code Organization
- Services in `src/services/` handle data fetching and processing
- Utils in `src/utils/` for shared helper functions
- Components grouped by complexity (simple/deep)

### Naming Conventions
- Analysis components end with `Analytics` or `Analysis`
- Service files end with `Service.ts`
- Utility files end with `Utils.ts`

### State Management
- React Context for auth state
- Local component state for UI
- Supabase for real-time updates

## Integration Points

### External APIs
- Lichess API: Game history and player data
- Chess.com API: Player statistics
- Handle rate limits and pagination

### Python Backend
- REST API on `localhost:8001`
- Health endpoint at `/health`
- Analysis endpoints in `docs/API.md`

### Database
- Direct Supabase queries for simple data
- Edge functions for complex operations
- RLS policies for security

## Common Workflows

1. **Adding Analytics Features**
   - Create service in `src/services/`
   - Add component in `src/components/simple/` or `src/components/deep/`
   - Update database schema if needed
   - Add tests and documentation

2. **Debugging Analysis**
   - Check Python backend logs
   - Verify Supabase connection
   - Validate analysis parameters
   - Test with sample games

Remember: Prefer simple, direct solutions over complex implementations. The project started as a simplified version of a more complex system.