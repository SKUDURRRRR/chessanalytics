// Check if Python backend meets all requirements
// Run this in the browser console to test

async function checkBackendRequirements() {
  console.log('=== Checking Backend Requirements ===')
  
  const ANALYSIS_API_URL = 'http://localhost:8002'
  
  try {
    // 1. Check if backend is running
    console.log('1. Checking if backend is running...')
    const healthResponse = await fetch(`${ANALYSIS_API_URL}/health`)
    
    if (healthResponse.ok) {
      const healthData = await healthResponse.json()
      console.log('✅ Backend is running:', healthData)
    } else {
      console.log('❌ Backend is not responding:', healthResponse.status)
      return
    }
    
    // 2. Check if analyze-games endpoint works
    console.log('2. Testing analyze-games endpoint...')
    const testAnalysisResponse = await fetch(`${ANALYSIS_API_URL}/analyze-games`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: 'testuser',
        platform: 'lichess',
        limit: 1
      })
    })
    
    if (testAnalysisResponse.ok) {
      const testData = await testAnalysisResponse.json()
      console.log('✅ analyze-games endpoint works:', testData)
    } else {
      console.log('❌ analyze-games endpoint failed:', testAnalysisResponse.status, await testAnalysisResponse.text())
    }
    
    // 3. Check if analysis results endpoint works
    console.log('3. Testing analysis results endpoint...')
    const resultsResponse = await fetch(`${ANALYSIS_API_URL}/analysis/testuser/lichess?limit=1`)
    
    if (resultsResponse.ok) {
      const resultsData = await resultsResponse.json()
      console.log('✅ analysis results endpoint works:', resultsData)
    } else {
      console.log('❌ analysis results endpoint failed:', resultsResponse.status, await resultsResponse.text())
    }
    
    // 4. Check if progress endpoint works
    console.log('4. Testing progress endpoint...')
    const progressResponse = await fetch(`${ANALYSIS_API_URL}/analysis-progress/testuser/lichess`)
    
    if (progressResponse.ok) {
      const progressData = await progressResponse.json()
      console.log('✅ progress endpoint works:', progressData)
    } else {
      console.log('❌ progress endpoint failed:', progressResponse.status, await progressResponse.text())
    }
    
    console.log('\n=== Summary ===')
    console.log('If all checks passed, the backend is ready for analysis!')
    console.log('If any failed, check:')
    console.log('- Python backend server is running on port 8002')
    console.log('- Environment variables are set correctly')
    console.log('- Stockfish is installed and accessible')
    console.log('- Database connection is working')
    
  } catch (error) {
    console.error('❌ Error checking backend requirements:', error)
    console.log('\nTroubleshooting:')
    console.log('1. Make sure Python backend is running: cd python && python main.py')
    console.log('2. Check if port 8002 is available')
    console.log('3. Verify environment variables in python/.env')
  }
}

// Uncomment to run:
// checkBackendRequirements()
