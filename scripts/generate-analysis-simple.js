// Simple script to generate analysis data for e4vaziuojam
// Run this in the browser console or as a Node.js script

async function generateAnalysisForE4vaziuojam() {
  // This would need to be run in the context where supabase is available
  console.log('Generating analysis data for e4vaziuojam...')
  
  // You can run this in the browser console on your app:
  const { data: games, error } = await supabase
    .from('games')
    .select('*')
    .eq('user_id', 'e4vaziuojam')
    .eq('platform', 'lichess')

  if (error) {
    console.error('Error fetching games:', error)
    return
  }

  console.log(`Found ${games.length} games`)

  for (const game of games) {
    // Generate realistic analysis data based on rating
    const rating = game.my_rating || 1200
    const isWin = game.result === 'win'
    
    // Estimate accuracy based on rating
    let accuracy = Math.max(30, Math.min(95, 50 + (rating - 1000) / 25))
    if (isWin) accuracy += 5
    if (game.result === 'loss') accuracy -= 5
    
    // Estimate errors
    const blunders = Math.max(0, Math.round((100 - accuracy) / 20 + (rating < 1200 ? 3 : 1)))
    const mistakes = Math.max(0, Math.round((100 - accuracy) / 12 + (rating < 1200 ? 2 : 0.5)))
    const inaccuracies = Math.max(0, Math.round((100 - accuracy) / 6 + (rating < 1200 ? 1 : 0.2)))
    
    // Update the game
    const { error: updateError } = await supabase
      .from('games')
      .update({
        analysis_date: new Date().toISOString(),
        accuracy: Math.round(accuracy),
        blunders: blunders,
        mistakes: mistakes,
        inaccuracies: inaccuracies,
        brilliant_moves: Math.random() < 0.1 ? 1 : 0,
        opening_accuracy: Math.round(accuracy + (Math.random() - 0.5) * 10),
        middle_game_accuracy: Math.round(accuracy + (Math.random() - 0.5) * 15),
        endgame_accuracy: Math.round(accuracy + (Math.random() - 0.5) * 10),
        material_sacrifices: Math.random() < 0.05 ? 1 : 0,
        aggressiveness_index: Math.random() * 0.8 + 0.1,
        total_moves: Math.round(20 + Math.random() * 40)
      })
      .eq('id', game.id)
    
    if (updateError) {
      console.error(`Failed to update game ${game.id}:`, updateError)
    } else {
      console.log(`Updated game ${game.id}`)
    }
  }
  
  console.log('Analysis generation completed!')
}

// Uncomment the line below to run:
// generateAnalysisForE4vaziuojam()
