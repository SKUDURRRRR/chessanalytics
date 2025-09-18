# API Documentation

This document provides comprehensive API documentation for the Chess Analytics application.

## 📋 Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Error Handling](#error-handling)
- [Frontend API](#frontend-api)
- [Backend API](#backend-api)
- [Types and Interfaces](#types-and-interfaces)
- [Configuration](#configuration)
- [Examples](#examples)

## 🔍 Overview

The Chess Analytics application provides a comprehensive API for analyzing chess games and player performance. The API is built with TypeScript and provides type-safe interfaces for all operations.

### Architecture
- **Frontend**: React + TypeScript + Vite
- **Backend**: Python + FastAPI
- **Database**: Supabase (PostgreSQL)
- **Analysis Engine**: Stockfish

## 🔐 Authentication

### Authentication Methods

#### 1. Supabase Authentication (Recommended)
```typescript
import { supabase } from './lib/supabase'

// Sign in
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password'
})

// Get current session
const { data: { session } } = await supabase.auth.getSession()

// Sign out
await supabase.auth.signOut()
```

#### 2. JWT Token Authentication (Backend)
```typescript
// Include JWT token in API requests
const response = await fetch('/api/analyze-games', {
  headers: {
    'Authorization': `Bearer ${jwtToken}`,
    'Content-Type': 'application/json'
  }
})
```

### Authentication Context
```typescript
import { useAuth } from './contexts/AuthContext'

function MyComponent() {
  const { user, signIn, signOut, loading } = useAuth()
  
  if (loading) return <div>Loading...</div>
  if (!user) return <div>Please sign in</div>
  
  return <div>Welcome, {user.email}!</div>
}
```

## ⚠️ Error Handling

### Error Types

#### 1. Validation Errors
```typescript
import { ValidationError } from './lib/errorHandling'

try {
  validateInput(data, validator)
} catch (error) {
  if (error instanceof ValidationError) {
    console.error('Validation failed:', error.message)
    console.error('Field:', error.context?.field)
  }
}
```

#### 2. API Errors
```typescript
import { handleApiError, NetworkError, NotFoundError } from './lib/errorHandling'

try {
  const response = await fetch('/api/data')
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }
} catch (error) {
  const apiError = handleApiError(error, 'fetching data')
  
  if (apiError instanceof NetworkError) {
    console.error('Network error:', apiError.message)
  } else if (apiError instanceof NotFoundError) {
    console.error('Resource not found:', apiError.message)
  }
}
```

#### 3. Database Errors
```typescript
import { DatabaseError } from './lib/errorHandling'

try {
  const { data, error } = await supabase.from('games').select('*')
  if (error) throw error
} catch (error) {
  const dbError = new DatabaseError('select games', error)
  console.error('Database error:', dbError.message)
}
```

### Error Response Format
```typescript
interface ErrorResponse {
  success: false
  error: {
    code: string
    message: string
    timestamp: string
    requestId?: string
    context?: Record<string, any>
    stack?: string
  }
}
```

## 🎯 Frontend API

### Services

#### Analysis Service
```typescript
import { AnalysisService } from './services/analysisService'

// Start analysis
const result = await AnalysisService.startAnalysis(
  'user123',
  'lichess',
  10 // limit
)

// Get analysis results
const analyses = await AnalysisService.getAnalysisResults(
  'user123',
  'lichess',
  10
)

// Get analysis statistics
const stats = await AnalysisService.getAnalysisStats(
  'user123',
  'lichess'
)

// Check API availability
const isAvailable = await AnalysisService.checkApiAvailability()
```

#### Profile Service
```typescript
import { ProfileService } from './services/profileService'

// Get user profile
const profile = await ProfileService.getProfile('user123', 'lichess')

// Create user profile
const newProfile = await ProfileService.createProfile({
  user_id: 'user123',
  platform: 'lichess',
  username: 'player123',
  display_name: 'Chess Player'
})

// Update profile
const updatedProfile = await ProfileService.updateProfile(
  'user123',
  'lichess',
  { display_name: 'New Name' }
)
```

#### Deep Analysis Service
```typescript
import { DeepAnalysisService } from './services/deepAnalysisService'

// Get deep analysis data
const deepData = await DeepAnalysisService.getDeepAnalysisData(
  'user123',
  'lichess'
)

// Calculate personality scores
const scores = await DeepAnalysisService.calculatePersonalityScoresFromGames(
  games
)
```

### Hooks

#### Configuration Hook
```typescript
import { useConfig } from './lib/config'

function SettingsComponent() {
  const { ui, features, updateUI, updateFeatures } = useConfig()
  
  const handleThemeChange = (theme: 'light' | 'dark' | 'auto') => {
    updateUI({ theme })
  }
  
  const handleFeatureToggle = (feature: keyof FeatureFlags, enabled: boolean) => {
    updateFeatures({ [feature]: enabled })
  }
  
  return (
    <div>
      <select value={ui.theme} onChange={(e) => handleThemeChange(e.target.value)}>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
        <option value="auto">Auto</option>
      </select>
    </div>
  )
}
```

#### Error Boundary Hook
```typescript
import { createErrorBoundary } from './lib/errorHandling'

const ErrorBoundary = createErrorBoundary('MyComponent', (error, errorInfo) => {
  console.error('Component error:', error, errorInfo)
})

function MyComponent() {
  return (
    <ErrorBoundary>
      <div>My component content</div>
    </ErrorBoundary>
  )
}
```

## 🔧 Backend API

### Endpoints

#### Health Check
```http
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00Z",
  "version": "1.0.0"
}
```

#### Analyze Games
```http
POST /analyze-games
```

**Request Body:**
```json
{
  "user_id": "user123",
  "platform": "lichess",
  "analysis_type": "stockfish",
  "limit": 10,
  "depth": 15,
  "skill_level": 20
}
```

**Response:**
```json
{
  "success": true,
  "message": "Analysis started successfully",
  "analysis_id": "analysis_123"
}
```

#### Get Analysis Results
```http
GET /analysis/{user_id}/{platform}?limit=10
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "game_id": "game123",
      "accuracy": 85.5,
      "blunders": 2,
      "mistakes": 5,
      "inaccuracies": 8,
      "brilliant_moves": 1,
      "opening_accuracy": 90.0,
      "middle_game_accuracy": 80.0,
      "endgame_accuracy": 75.0
    }
  ]
}
```

#### Get Analysis Statistics
```http
GET /analysis-stats/{user_id}/{platform}?analysis_type=stockfish
```

**Response:**
```json
{
  "success": true,
  "data": {
    "total_games_analyzed": 50,
    "average_accuracy": 82.3,
    "total_blunders": 25,
    "total_mistakes": 100,
    "total_inaccuracies": 150,
    "total_brilliant_moves": 10,
    "average_opening_accuracy": 85.0,
    "average_middle_game_accuracy": 80.0,
    "average_endgame_accuracy": 75.0
  }
}
```

#### Get Analysis Progress
```http
GET /analysis-progress/{user_id}/{platform}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "analyzed_games": 25,
    "total_games": 50,
    "progress_percentage": 50.0,
    "is_complete": false,
    "current_phase": "analyzing",
    "estimated_time_remaining": 300
  }
}
```

### Error Responses

#### Validation Error
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input for field 'user_id'",
    "timestamp": "2024-01-01T00:00:00Z",
    "context": {
      "field": "user_id"
    }
  }
}
```

#### Authentication Error
```json
{
  "success": false,
  "error": {
    "code": "AUTHENTICATION_ERROR",
    "message": "Authentication required",
    "timestamp": "2024-01-01T00:00:00Z"
  }
}
```

#### Rate Limit Error
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_ERROR",
    "message": "Rate limit exceeded",
    "timestamp": "2024-01-01T00:00:00Z",
    "context": {
      "retryAfter": 60
    }
  }
}
```

## 📊 Types and Interfaces

### Core Types
```typescript
// Platform types
type Platform = 'lichess' | 'chess.com'

// Analysis types
type AnalysisType = 'basic' | 'stockfish' | 'deep'

// Game result types
type GameResult = 'win' | 'loss' | 'draw'

// Player color types
type PlayerColor = 'white' | 'black'
```

### Game Analysis Types
```typescript
interface GameAnalysisSummary {
  game_id: string
  accuracy: number
  blunders: number
  mistakes: number
  inaccuracies: number
  brilliant_moves: number
  opening_accuracy: number
  middle_game_accuracy: number
  endgame_accuracy: number
  user_id: string
  platform: Platform
  analysis_type: AnalysisType
  // ... additional fields
}

interface AnalysisStats {
  total_games_analyzed: number
  average_accuracy: number
  total_blunders: number
  total_mistakes: number
  total_inaccuracies: number
  total_brilliant_moves: number
  average_opening_accuracy: number
  average_middle_game_accuracy: number
  average_endgame_accuracy: number
}
```

### User Profile Types
```typescript
interface UserProfile {
  id: string
  user_id: string
  platform: Platform
  username?: string
  display_name?: string
  rating?: number
  total_games: number
  win_rate: number
  last_accessed: string
  created_at: string
  updated_at: string
}
```

### Deep Analysis Types
```typescript
interface DeepAnalysisData {
  totalGames: number
  averageAccuracy: number
  currentRating: number
  personalityScores: {
    tactical: number
    positional: number
    aggressive: number
    patient: number
    endgame: number
    opening: number
    novelty: number
    staleness: number
  }
  playerLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert'
  playerStyle: {
    category: 'positional' | 'tactical' | 'aggressive' | 'balanced'
    description: string
    confidence: number
  }
  // ... additional fields
}
```

## ⚙️ Configuration

### Environment Variables
```bash
# Frontend
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
VITE_ANALYSIS_API_URL=http://localhost:8002
VITE_DEBUG=false
VITE_LOG_LEVEL=info

# Backend
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
API_HOST=127.0.0.1
API_PORT=8002
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
API_DEBUG=false
STOCKFISH_PATH=stockfish
STOCKFISH_DEPTH=15
STOCKFISH_SKILL_LEVEL=20
```

### Configuration Management
```typescript
import { config, useConfig } from './lib/config'

// Get configuration
const apiConfig = config.getApi()
const analysisConfig = config.getAnalysis()
const features = config.getFeatures()

// Update configuration
config.updateUI({ theme: 'dark' })
config.updateFeatures({ enableDeepAnalysis: false })

// Validate configuration
const validation = config.validate()
if (!validation.isValid) {
  console.error('Configuration errors:', validation.errors)
}
```

## 📝 Examples

### Complete Analysis Workflow
```typescript
import { AnalysisService, ProfileService } from './services'

async function analyzeUser(userId: string, platform: Platform) {
  try {
    // 1. Get or create user profile
    let profile = await ProfileService.getProfile(userId, platform)
    if (!profile) {
      profile = await ProfileService.createProfile({
        user_id: userId,
        platform,
        username: userId
      })
    }

    // 2. Start analysis
    const analysisResult = await AnalysisService.startAnalysis(
      userId,
      platform,
      20 // analyze 20 games
    )

    if (!analysisResult.success) {
      throw new Error(analysisResult.message)
    }

    // 3. Monitor progress
    const progress = await AnalysisService.getAnalysisProgress(userId, platform)
    console.log(`Progress: ${progress.progress_percentage}%`)

    // 4. Get results when complete
    if (progress.is_complete) {
      const analyses = await AnalysisService.getAnalysisResults(userId, platform)
      const stats = await AnalysisService.getAnalysisStats(userId, platform)
      
      return { analyses, stats }
    }

  } catch (error) {
    console.error('Analysis failed:', error)
    throw error
  }
}
```

### Error Handling Example
```typescript
import { 
  withErrorHandling, 
  retryWithBackoff, 
  handleApiError,
  ValidationError,
  NetworkError 
} from './lib/errorHandling'

// Wrap function with error handling
const safeAnalyzeUser = withErrorHandling(analyzeUser, 'analyzeUser')

// Retry with backoff
const result = await retryWithBackoff(
  () => AnalysisService.getAnalysisStats(userId, platform),
  3, // max retries
  1000, // base delay
  'getAnalysisStats'
)

// Handle API errors
try {
  const response = await fetch('/api/data')
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
} catch (error) {
  const apiError = handleApiError(error, 'fetching data')
  
  if (apiError instanceof ValidationError) {
    // Handle validation error
  } else if (apiError instanceof NetworkError) {
    // Handle network error
  }
}
```

### Configuration Example
```typescript
import { useConfig } from './lib/config'

function SettingsPage() {
  const { ui, features, updateUI, updateFeatures } = useConfig()
  
  return (
    <div>
      <h2>Settings</h2>
      
      <div>
        <label>Theme:</label>
        <select 
          value={ui.theme} 
          onChange={(e) => updateUI({ theme: e.target.value as any })}
        >
          <option value="light">Light</option>
          <option value="dark">Dark</option>
          <option value="auto">Auto</option>
        </select>
      </div>
      
      <div>
        <label>Items per page:</label>
        <input
          type="number"
          value={ui.itemsPerPage}
          onChange={(e) => updateUI({ itemsPerPage: parseInt(e.target.value) })}
          min="1"
          max="100"
        />
      </div>
      
      <div>
        <label>
          <input
            type="checkbox"
            checked={features.enableDeepAnalysis}
            onChange={(e) => updateFeatures({ enableDeepAnalysis: e.target.checked })}
          />
          Enable Deep Analysis
        </label>
      </div>
    </div>
  )
}
```

## 🔍 Troubleshooting

### Common Issues

#### 1. Authentication Errors
- Ensure Supabase credentials are correctly configured
- Check if user is properly authenticated
- Verify JWT token is valid and not expired

#### 2. Network Errors
- Check if the analysis API is running
- Verify CORS configuration
- Ensure network connectivity

#### 3. Validation Errors
- Check input data format and types
- Verify required fields are provided
- Ensure data meets validation constraints

#### 4. Database Errors
- Check database connection
- Verify RLS policies
- Ensure proper permissions

### Debug Mode
Enable debug mode for detailed logging:
```bash
VITE_DEBUG=true
VITE_LOG_LEVEL=debug
```

### Error Reporting
Enable error reporting for production:
```bash
VITE_ENABLE_ERROR_REPORTING=true
```

## 📚 Additional Resources

- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [React Documentation](https://react.dev/)
- [Supabase Documentation](https://supabase.com/docs)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Stockfish Documentation](https://stockfishchess.org/)
