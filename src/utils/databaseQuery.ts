/**
 * Direct Database Query Utility
 * Helps debug database content and user ID issues
 */

import { supabase } from '../lib/supabase'

export async function checkUserDataInDatabase(userId: string, platform: string) {
  console.log(`🔍 Checking database for user: "${userId}" on platform: "${platform}"`)
  
  // Check different variations of the user ID
  const variations = [
    userId, // Original
    userId.toLowerCase(), // Lowercase
    userId.toUpperCase(), // Uppercase
    userId.trim(), // Trimmed
    userId.trim().toLowerCase(), // Trimmed + lowercase
  ]
  
  console.log('🔍 Testing user ID variations:', variations)
  
  const results: { [key: string]: any } = {}
  
  for (const variation of variations) {
    try {
      // Check games table
      const { data: gamesData, error: gamesError } = await supabase
        .from('games')
        .select('id, user_id, platform, provider_game_id')
        .eq('user_id', variation)
        .eq('platform', platform)
        .limit(5)
      
      // Check game_analyses table
      const { data: gameAnalysesData, error: gameAnalysesError } = await supabase
        .from('game_analyses')
        .select('game_id, user_id, platform, analysis_type')
        .eq('user_id', variation)
        .eq('platform', platform)
        .limit(5)
      
      // Check move_analyses table
      const { data: moveAnalysesData, error: moveAnalysesError } = await supabase
        .from('move_analyses')
        .select('game_id, user_id, platform, analysis_method')
        .eq('user_id', variation)
        .eq('platform', platform)
        .limit(5)
      
      // Check unified_analyses view
      const { data: unifiedData, error: unifiedError } = await supabase
        .from('unified_analyses')
        .select('game_id, user_id, platform, analysis_type')
        .eq('user_id', variation)
        .eq('platform', platform)
        .limit(5)
      
      results[variation] = {
        games: { data: gamesData, error: gamesError, count: gamesData?.length || 0 },
        gameAnalyses: { data: gameAnalysesData, error: gameAnalysesError, count: gameAnalysesData?.length || 0 },
        moveAnalyses: { data: moveAnalysesData, error: moveAnalysesError, count: moveAnalysesData?.length || 0 },
        unified: { data: unifiedData, error: unifiedError, count: unifiedData?.length || 0 },
      }
      
      console.log(`📊 User ID "${variation}":`, {
        games: results[variation].games.count,
        gameAnalyses: results[variation].gameAnalyses.count,
        moveAnalyses: results[variation].moveAnalyses.count,
        unified: results[variation].unified.count,
      })
      
    } catch (error) {
      console.error(`❌ Error checking variation "${variation}":`, error)
      results[variation] = { error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }
  
  return results
}

export async function checkAllUsersInDatabase(platform: string) {
  console.log(`🔍 Checking all users in database for platform: ${platform}`)
  
  try {
    // Get all unique user IDs from games table
    const { data: gamesData, error: gamesError } = await supabase
      .from('games')
      .select('user_id')
      .eq('platform', platform)
      .limit(100)
    
    if (gamesError) {
      console.error('❌ Error fetching users from games table:', gamesError)
      return { error: gamesError.message }
    }
    
    const uniqueUsers = [...new Set((gamesData || []).map((g: { user_id: string }) => g.user_id))]
    console.log(`📊 Found ${uniqueUsers.length} unique users in games table:`, uniqueUsers)
    
    // Get all unique user IDs from game_analyses table
    const { data: gameAnalysesData, error: gameAnalysesError } = await supabase
      .from('game_analyses')
      .select('user_id')
      .eq('platform', platform)
      .limit(100)
    
    if (gameAnalysesError) {
      console.error('❌ Error fetching users from game_analyses table:', gameAnalysesError)
    } else {
      const uniqueAnalysesUsers = [...new Set((gameAnalysesData || []).map((g: { user_id: string }) => g.user_id))]
      console.log(`📊 Found ${uniqueAnalysesUsers.length} unique users in game_analyses table:`, uniqueAnalysesUsers)
    }
    
    // Get all unique user IDs from move_analyses table
    const { data: moveAnalysesData, error: moveAnalysesError } = await supabase
      .from('move_analyses')
      .select('user_id')
      .eq('platform', platform)
      .limit(100)
    
    if (moveAnalysesError) {
      console.error('❌ Error fetching users from move_analyses table:', moveAnalysesError)
    } else {
      const uniqueMoveAnalysesUsers = [...new Set((moveAnalysesData || []).map((g: { user_id: string }) => g.user_id))]
      console.log(`📊 Found ${uniqueMoveAnalysesUsers.length} unique users in move_analyses table:`, uniqueMoveAnalysesUsers)
    }
    
    return {
      gamesUsers: uniqueUsers,
      gameAnalysesUsers: gameAnalysesData ? [...new Set((gameAnalysesData || []).map((g: { user_id: string }) => g.user_id))] : [],
      moveAnalysesUsers: moveAnalysesData ? [...new Set((moveAnalysesData || []).map((g: { user_id: string }) => g.user_id))] : [],
    }
    
  } catch (error) {
    console.error('❌ Error checking all users:', error)
    return { error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

export async function testUnifiedAnalysesView(userId: string, platform: string) {
  console.log(`🔍 Testing unified_analyses view for user: "${userId}" on platform: "${platform}"`)
  
  try {
    // Test with different analysis types
    const analysisTypes = ['basic', 'stockfish', 'deep']
    const results: { [key: string]: any } = {}
    
    for (const analysisType of analysisTypes) {
      const { data, error } = await supabase
        .from('unified_analyses')
        .select('*')
        .eq('user_id', userId)
        .eq('platform', platform)
        .eq('analysis_type', analysisType)
        .limit(5)
      
      results[analysisType] = {
        data: data || [],
        error: error,
        count: data?.length || 0
      }
      
      console.log(`📊 Analysis type "${analysisType}": ${results[analysisType].count} records`)
      if (error) {
        console.error(`❌ Error with analysis type "${analysisType}":`, error)
      }
    }
    
    // Also test without analysis_type filter
    const { data: allData, error: allError } = await supabase
      .from('unified_analyses')
      .select('*')
      .eq('user_id', userId)
      .eq('platform', platform)
      .limit(10)
    
    results['all'] = {
      data: allData || [],
      error: allError,
      count: allData?.length || 0
    }
    
    console.log(`📊 All analysis types: ${results['all'].count} records`)
    if (allError) {
      console.error('❌ Error fetching all analysis types:', allError)
    }
    
    return results
    
  } catch (error) {
    console.error('❌ Error testing unified_analyses view:', error)
    return { error: error instanceof Error ? error.message : 'Unknown error' }
  }
}
