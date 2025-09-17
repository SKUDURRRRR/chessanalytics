// Script to check analysis data for e4vaziuojam
// Run this in the browser console on your app page

async function checkUserAnalysis() {
  console.log('Checking analysis data for e4vaziuojam...')
  
  try {
    // Check game_analyses table
    const { data: analyses, error: analysesError } = await supabase
      .from('game_analyses')
      .select('*')
      .eq('user_id', 'e4vaziuojam')
      .eq('platform', 'lichess')
      .order('analysis_date', { ascending: false })

    if (analysesError) {
      console.error('Error fetching analyses:', analysesError)
      return
    }

    console.log(`Found ${analyses.length} analyses in game_analyses table`)
    
    if (analyses.length > 0) {
      console.log('Sample analysis data:')
      console.log(analyses[0])
      
      // Calculate averages
      const avgAccuracy = analyses.reduce((sum, a) => sum + (a.accuracy || 0), 0) / analyses.length
      const avgBlunders = analyses.reduce((sum, a) => sum + (a.blunders || 0), 0) / analyses.length
      const avgMistakes = analyses.reduce((sum, a) => sum + (a.mistakes || 0), 0) / analyses.length
      const avgTactical = analyses.reduce((sum, a) => sum + (a.tactical_score || 0), 0) / analyses.length
      const avgPositional = analyses.reduce((sum, a) => sum + (a.positional_score || 0), 0) / analyses.length
      
      console.log('Averages:', {
        accuracy: avgAccuracy.toFixed(2),
        blunders: avgBlunders.toFixed(2),
        mistakes: avgMistakes.toFixed(2),
        tactical: avgTactical.toFixed(2),
        positional: avgPositional.toFixed(2)
      })
    } else {
      console.log('No analysis data found in game_analyses table')
    }

    // Also check games table
    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select('*')
      .eq('user_id', 'e4vaziuojam')
      .eq('platform', 'lichess')
      .order('played_at', { ascending: false })

    if (gamesError) {
      console.error('Error fetching games:', gamesError)
      return
    }

    console.log(`Found ${games.length} games in games table`)
    
    if (games.length > 0) {
      const gamesWithAnalysis = games.filter(g => g.analysis_date)
      console.log(`Games with analysis_date: ${gamesWithAnalysis.length}`)
      
      if (gamesWithAnalysis.length > 0) {
        console.log('Sample game with analysis:', gamesWithAnalysis[0])
      }
    }

  } catch (error) {
    console.error('Error:', error)
  }
}

// Uncomment to run:
// checkUserAnalysis()
