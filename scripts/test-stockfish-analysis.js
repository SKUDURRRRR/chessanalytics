// Test script for Stockfish analysis
// Run this in the browser console to test the analysis functionality

async function testStockfishAnalysis() {
  console.log('=== Testing Stockfish Analysis ===')
  
  const userId = 'e4vaziuojam' // or any user you want to test
  const platform = 'lichess'
  
  try {
    // Check if API is available
    console.log('1. Checking API health...')
    const isHealthy = await AnalysisService.checkHealth()
    console.log('API Health:', isHealthy ? '✅ Available' : '❌ Not available')
    
    if (!isHealthy) {
      console.log('❌ Analysis API is not available. Please start the Python backend server.')
      return
    }
    
    // Start analysis
    console.log('2. Starting analysis...')
    const result = await AnalysisService.startAnalysis(userId, platform, 5) // Analyze 5 games
    console.log('Start result:', result)
    
    if (result.success) {
      console.log('✅ Analysis started successfully!')
      
      // Poll for progress
      console.log('3. Polling progress...')
      let attempts = 0
      const maxAttempts = 30 // 1 minute max
      
      const pollProgress = async () => {
        try {
          const progress = await AnalysisService.getAnalysisProgress(userId, platform)
          console.log('Progress:', progress)
          
          if (progress && progress.is_complete) {
            console.log('✅ Analysis complete!')
            
            // Get results
            console.log('4. Fetching results...')
            const results = await AnalysisService.getAnalysisResults(userId, platform, 5)
            console.log('Analysis results:', results)
            
            // Get stats
            const stats = await AnalysisService.getAnalysisStats(userId, platform)
            console.log('Analysis stats:', stats)
            
          } else if (attempts < maxAttempts) {
            attempts++
            setTimeout(pollProgress, 2000) // Poll every 2 seconds
          } else {
            console.log('⏰ Timeout waiting for analysis to complete')
          }
        } catch (error) {
          console.error('Error polling progress:', error)
        }
      }
      
      setTimeout(pollProgress, 1000)
      
    } else {
      console.log('❌ Failed to start analysis:', result.message)
    }
    
  } catch (error) {
    console.error('Error testing analysis:', error)
  }
}

// Uncomment to run:
// testStockfishAnalysis()
