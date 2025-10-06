import { useState } from 'react'
import { UnifiedAnalysisService } from '../../services/unifiedAnalysisService'

interface DataGeneratorProps {
  userId: string
  platform: 'lichess' | 'chess.com'
  onAnalysisComplete?: () => void
}

export function DataGenerator({ userId, platform, onAnalysisComplete }: DataGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [progress, setProgress] = useState<number>(0)

  const handleGenerateData = async () => {
    try {
      setIsGenerating(true)
      setMessage('Starting Stockfish analysis...')
      setProgress(0)

      // Start the analysis process
      const result = await UnifiedAnalysisService.startBatchAnalysis(userId, platform, 'stockfish', 100)

      if (result.success) {
        setMessage(
          'Stockfish analysis started successfully! Analyzing your last 100 games - this may take several minutes. The page will refresh automatically when complete.'
        )

        // Poll for progress
        const pollProgress = async () => {
          try {
            const progressResult = await UnifiedAnalysisService.getAnalysisProgress(userId, platform)
            if (progressResult && progressResult.progress_percentage !== undefined) {
              setProgress(progressResult.progress_percentage)
              setMessage(
                `Analysis in progress... ${progressResult.progress_percentage}% complete (${progressResult.analyzed_games}/${progressResult.total_games} games)`
              )

              if (progressResult.progress_percentage < 100 && !progressResult.is_complete) {
                setTimeout(pollProgress, 2000) // Poll every 2 seconds
              } else {
                setMessage('Analysis complete! Refreshing data...')
                // Trigger data refresh
                if (onAnalysisComplete) {
                  onAnalysisComplete()
                }
              }
            } else if (progressResult && progressResult.is_complete) {
              setMessage('Analysis complete! Refreshing data...')
              // Trigger data refresh
              if (onAnalysisComplete) {
                onAnalysisComplete()
              }
            }
          } catch (error) {
            console.error('Error polling progress:', error)
            // Continue polling even if there's an error
            setTimeout(pollProgress, 5000) // Poll every 5 seconds on error
          }
        }

        // Start polling after a short delay
        setTimeout(pollProgress, 1000)
      } else {
        setMessage(`Error: ${result.message || 'Failed to start analysis'}`)
      }
    } catch (error) {
      console.error('Error starting analysis:', error)
      setMessage(
        `Error: ${error instanceof Error ? error.message : 'Unknown error occurred. Please ensure the Python backend server is running.'}`
      )
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-blue-800">Stockfish Analysis</h3>
          <p className="text-sm text-blue-700">
            Run real Stockfish analysis on your last 100 games to get accurate personality insights
          </p>
        </div>
        <button
          onClick={handleGenerateData}
          disabled={isGenerating}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
        >
          {isGenerating ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Analyzing...
            </>
          ) : (
            <>
              <span>Search</span>
              Analyze with Stockfish
            </>
          )}
        </button>
      </div>

      {message && (
        <div className="mt-3 p-3 bg-white rounded border">
          <p className="text-sm text-gray-700">{message}</p>
          {progress > 0 && progress < 100 && (
            <div className="mt-2">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
              <p className="text-xs text-gray-500 mt-1">{progress}% complete</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
