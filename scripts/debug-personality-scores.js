// Debug script to check why all players get similar personality scores
// Run this in the browser console

async function debugPersonalityScores() {
  console.log('=== DEBUGGING PERSONALITY SCORES ===')
  
  // Check a few different users
  const testUsers = ['e4vaziuojam', 'skudurelis', 'testuser1']
  
  for (const userId of testUsers) {
    console.log(`\n--- Checking user: ${userId} ---`)
    
    try {
      // Check games table
      const { data: games } = await supabase
        .from('games')
        .select('*')
        .eq('user_id', userId)
        .eq('platform', 'lichess')
        .limit(5)
      
      console.log(`Games found: ${games?.length || 0}`)
      if (games && games.length > 0) {
        console.log('Sample game:', {
          id: games[0].id,
          result: games[0].result,
          my_rating: games[0].my_rating,
          accuracy: games[0].accuracy,
          blunders: games[0].blunders,
          analysis_date: games[0].analysis_date
        })
      }
      
      // Check game_analyses table
      const { data: analyses } = await supabase
        .from('game_analyses')
        .select('*')
        .eq('user_id', userId)
        .eq('platform', 'lichess')
        .limit(5)
      
      console.log(`Analyses found: ${analyses?.length || 0}`)
      if (analyses && analyses.length > 0) {
        console.log('Sample analysis:', {
          game_id: analyses[0].game_id,
          accuracy: analyses[0].accuracy,
          blunders: analyses[0].blunders,
          tactical_score: analyses[0].tactical_score,
          positional_score: analyses[0].positional_score
        })
      }
      
      // Test the deep analysis function
      console.log('Testing deep analysis...')
      const deepAnalysis = await fetchDeepAnalysis(userId, 'lichess')
      console.log('Personality scores:', deepAnalysis.personalityScores)
      
    } catch (error) {
      console.error(`Error checking ${userId}:`, error)
    }
  }
  
  console.log('\n=== SUMMARY ===')
  console.log('If all users show similar scores, the issue is likely:')
  console.log('1. No data in game_analyses table (falling back to estimation)')
  console.log('2. Estimation formula is too generic (based only on rating)')
  console.log('3. All users have similar ratings and win rates')
}

// Uncomment to run:
// debugPersonalityScores()
