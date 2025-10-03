/**
 * Database Diagnostics Utility
 * Helps debug database connection and data availability issues
 */

import { supabase } from '../lib/supabase'

// Canonicalize user ID to match backend logic
function canonicalizeUserId(userId: string, platform: string): string {
  if (platform === 'chess.com') {
    return userId.trim().toLowerCase()
  } else { // lichess
    return userId.trim()
  }
}

export interface DatabaseDiagnostics {
  connectionStatus: 'connected' | 'disconnected' | 'error'
  tablesAvailable: string[]
  userDataExists: boolean
  analysisDataExists: boolean
  mockDataDetected: boolean
  recommendations: string[]
}

export async function runDatabaseDiagnostics(userId: string, platform: string): Promise<DatabaseDiagnostics> {
  const canonicalUserId = canonicalizeUserId(userId, platform)
  const diagnostics: DatabaseDiagnostics = {
    connectionStatus: 'disconnected',
    tablesAvailable: [],
    userDataExists: false,
    analysisDataExists: false,
    mockDataDetected: false,
    recommendations: []
  }

  try {
    // Test basic connection
    console.log('🔍 Running database diagnostics...')
    
    // Check if we can connect to Supabase
    const { error: healthError } = await supabase
      .from('games')
      .select('count')
      .limit(1)
    
    if (healthError) {
      diagnostics.connectionStatus = 'error'
      diagnostics.recommendations.push('Database connection failed. Check Supabase credentials.')
      console.error('❌ Database connection error:', healthError)
      return diagnostics
    }

    diagnostics.connectionStatus = 'connected'
    console.log('✅ Database connection successful')

    // Check available tables
    const tables = ['games', 'game_analyses', 'move_analyses', 'unified_analyses']
    for (const table of tables) {
      try {
        const { error } = await supabase.from(table).select('count').limit(1)
        if (!error) {
          diagnostics.tablesAvailable.push(table)
        }
      } catch (e) {
        console.warn(`⚠️ Table ${table} not accessible:`, e)
      }
    }

    console.log('📊 Available tables:', diagnostics.tablesAvailable)

    // Check for user data in games table
    const { data: gamesData, error: gamesError } = await supabase
      .from('games')
      .select('id, user_id, platform')
      .eq('user_id', canonicalUserId)
      .eq('platform', platform)
      .limit(1)

    if (gamesError) {
      console.error('❌ Error checking games data:', gamesError)
    } else {
      diagnostics.userDataExists = gamesData && gamesData.length > 0
      console.log(`📈 User data exists: ${diagnostics.userDataExists} (${gamesData?.length || 0} games)`)
    }

    // Check for analysis data in unified_analyses view
    const { data: analysisData, error: analysisError } = await supabase
      .from('unified_analyses')
      .select('game_id, user_id, platform, analysis_type')
      .eq('user_id', canonicalUserId)
      .eq('platform', platform)
      .limit(1)

    if (analysisError) {
      console.error('❌ Error checking analysis data:', analysisError)
    } else {
      diagnostics.analysisDataExists = analysisData && analysisData.length > 0
      console.log(`🔬 Analysis data exists: ${diagnostics.analysisDataExists} (${analysisData?.length || 0} analyses)`)
    }

    // Check for data in individual analysis tables
    if (!diagnostics.analysisDataExists) {
      // Check game_analyses table
      const { data: gameAnalysesData } = await supabase
        .from('game_analyses')
        .select('game_id, user_id, platform, analysis_type')
        .eq('user_id', canonicalUserId)
        .eq('platform', platform)
        .limit(1)

      // Check move_analyses table
      const { data: moveAnalysesData } = await supabase
        .from('move_analyses')
        .select('game_id, user_id, platform, analysis_method')
        .eq('user_id', canonicalUserId)
        .eq('platform', platform)
        .limit(1)

      const hasGameAnalyses = gameAnalysesData && gameAnalysesData.length > 0
      const hasMoveAnalyses = moveAnalysesData && moveAnalysesData.length > 0

      console.log(`📊 Game analyses: ${hasGameAnalyses} (${gameAnalysesData?.length || 0})`)
      console.log(`📊 Move analyses: ${hasMoveAnalyses} (${moveAnalysesData?.length || 0})`)

      if (hasGameAnalyses || hasMoveAnalyses) {
        diagnostics.analysisDataExists = true
        diagnostics.recommendations.push('Analysis data exists but may not be visible in unified_analyses view. Check view definition.')
      }
    }

  // Generate recommendations
  if (!diagnostics.userDataExists) {
    diagnostics.recommendations.push('No games found for this user. Import games first using the import feature.')
  }

  if (!diagnostics.analysisDataExists) {
    if (diagnostics.userDataExists) {
      diagnostics.recommendations.push('✅ Games found but no analysis data. Click "Analyze My Games" to generate analysis data.')
      diagnostics.recommendations.push('This will run Stockfish analysis on your games and create the analytics you see.')
    } else {
      diagnostics.recommendations.push('No analysis data found. Run analysis on imported games.')
    }
  }

    if (diagnostics.tablesAvailable.length === 0) {
      diagnostics.recommendations.push('No database tables accessible. Check RLS policies and permissions.')
    }

    // Check for mock data patterns
    if (diagnostics.analysisDataExists && analysisData) {
      const hasMockPatterns = analysisData.some((analysis: { game_id?: string; analysis_type?: string }) =>
        analysis.game_id?.startsWith('mock_') ||
        analysis.analysis_type === 'mock'
      )
      diagnostics.mockDataDetected = hasMockPatterns
      
      if (hasMockPatterns) {
        diagnostics.recommendations.push('Mock data detected in database. Clear mock data and run real analysis.')
      }
    }

    console.log('🎯 Diagnostics complete:', diagnostics)
    return diagnostics

  } catch (error) {
    console.error('❌ Database diagnostics failed:', error)
    diagnostics.connectionStatus = 'error'
    diagnostics.recommendations.push('Database diagnostics failed. Check console for errors.')
    return diagnostics
  }
}

export async function testAnalysisTypes(userId: string, platform: string): Promise<{
  [analysisType: string]: { exists: boolean; count: number }
}> {
  const canonicalUserId = canonicalizeUserId(userId, platform)
  const results: { [analysisType: string]: { exists: boolean; count: number } } = {}
  
  const analysisTypes = ['stockfish', 'deep']
  
  for (const analysisType of analysisTypes) {
    try {
      const { data, error } = await supabase
        .from('unified_analyses')
        .select('game_id')
        .eq('user_id', canonicalUserId)
        .eq('platform', platform)
        .eq('analysis_type', analysisType)
      
      if (error) {
        console.error(`Error checking ${analysisType}:`, error)
        results[analysisType] = { exists: false, count: 0 }
      } else {
        results[analysisType] = { 
          exists: data && data.length > 0, 
          count: data?.length || 0 
        }
      }
    } catch (e) {
      console.error(`Exception checking ${analysisType}:`, e)
      results[analysisType] = { exists: false, count: 0 }
    }
  }
  
  console.log('🔍 Analysis type availability:', results)
  return results
}
