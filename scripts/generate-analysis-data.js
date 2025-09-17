#!/usr/bin/env node

/**
 * Script to generate analysis data for a user's games
 * This will populate the missing analysis fields in the games table
 */

import { createClient } from '@supabase/supabase-js'
import { DataGenerationService } from '../src/services/dataGenerationService.js'

// Load environment variables
import dotenv from 'dotenv'
dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function generateAnalysisForUser(userId, platform = 'lichess') {
  console.log(`Generating analysis data for user: ${userId} on platform: ${platform}`)
  
  try {
    // Fetch user's games
    const { data: games, error } = await supabase
      .from('games')
      .select('*')
      .eq('user_id', userId)
      .eq('platform', platform)
      .order('played_at', { ascending: false })

    if (error) {
      throw new Error(`Database error: ${error.message}`)
    }

    if (!games || games.length === 0) {
      console.log('No games found for this user')
      return
    }

    console.log(`Found ${games.length} games`)

    // Generate analysis data for each game
    for (const game of games) {
      const analysisData = DataGenerationService.generateGameAnalysis(
        game.my_rating || 1200,
        game.opponent_rating || 1200,
        game.result,
        game.opening || 'Unknown'
      )
      
      // Update the game with analysis data
      const { error: updateError } = await supabase
        .from('games')
        .update({
          analysis_date: new Date().toISOString(),
          accuracy: analysisData.accuracy,
          blunders: analysisData.blunders,
          mistakes: analysisData.mistakes,
          inaccuracies: analysisData.inaccuracies,
          brilliant_moves: analysisData.brilliant_moves,
          opening_accuracy: analysisData.opening_accuracy,
          middle_game_accuracy: analysisData.middle_game_accuracy,
          endgame_accuracy: analysisData.endgame_accuracy,
          material_sacrifices: analysisData.material_sacrifices,
          aggressiveness_index: analysisData.aggressiveness_index,
          total_moves: analysisData.total_moves
        })
        .eq('id', game.id)
      
      if (updateError) {
        console.error(`Failed to update game ${game.id}:`, updateError)
      } else {
        console.log(`Updated game ${game.id} with analysis data`)
      }
    }
    
    console.log(`Analysis generation completed for ${games.length} games`)
  } catch (error) {
    console.error('Error generating analysis:', error)
  }
}

// Get command line arguments
const userId = process.argv[2]
const platform = process.argv[3] || 'lichess'

if (!userId) {
  console.log('Usage: node generate-analysis-data.js <userId> [platform]')
  console.log('Example: node generate-analysis-data.js e4vaziuojam lichess')
  process.exit(1)
}

generateAnalysisForUser(userId, platform)
