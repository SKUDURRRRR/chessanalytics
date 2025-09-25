import React, { useState, useEffect } from 'react'
import { runDatabaseDiagnostics, testAnalysisTypes, DatabaseDiagnostics } from '../../utils/databaseDiagnostics'
import { checkUserDataInDatabase, checkAllUsersInDatabase, testUnifiedAnalysesView } from '../../utils/databaseQuery'
// Development-only diagnostics component. Import manually during local debugging.
if (import.meta.env.PROD) {
  throw new Error('DatabaseDiagnosticsComponent is development-only. Remove this import for production builds.')
}

interface DatabaseDiagnosticsProps {
  userId: string
  platform: string
  onDiagnosticsComplete?: (diagnostics: DatabaseDiagnostics) => void
}

export const DatabaseDiagnosticsComponent: React.FC<DatabaseDiagnosticsProps> = ({
  userId,
  platform,
  onDiagnosticsComplete
}) => {
  const [diagnostics, setDiagnostics] = useState<DatabaseDiagnostics | null>(null)
  const [analysisTypes, setAnalysisTypes] = useState<{ [key: string]: { exists: boolean; count: number } } | null>(null)
  const [userVariations, setUserVariations] = useState<any>(null)
  const [allUsers, setAllUsers] = useState<any>(null)
  const [unifiedViewTest, setUnifiedViewTest] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const runDiagnostics = async () => {
    if (!userId || !platform) return

    setLoading(true)
    setError(null)

    try {
      console.log(`🔍 Running diagnostics for ${userId} on ${platform}`)
      
      const [diagnosticsResult, analysisTypesResult, userVariationsResult, allUsersResult, unifiedViewResult] = await Promise.all([
        runDatabaseDiagnostics(userId, platform),
        testAnalysisTypes(userId, platform),
        checkUserDataInDatabase(userId, platform),
        checkAllUsersInDatabase(platform),
        testUnifiedAnalysesView(userId, platform)
      ])

      setDiagnostics(diagnosticsResult)
      setAnalysisTypes(analysisTypesResult)
      setUserVariations(userVariationsResult)
      setAllUsers(allUsersResult)
      setUnifiedViewTest(unifiedViewResult)
      
      if (onDiagnosticsComplete) {
        onDiagnosticsComplete(diagnosticsResult)
      }
    } catch (err) {
      console.error('Diagnostics failed:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    runDiagnostics()
  }, [userId, platform])

  if (loading) {
    return (
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          <span className="text-blue-800">Running database diagnostics...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-center space-x-2">
          <span className="text-red-600">❌</span>
          <span className="text-red-800">Diagnostics failed: {error}</span>
        </div>
        <button
          onClick={runDiagnostics}
          className="mt-2 px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    )
  }

  if (!diagnostics) {
    return null
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected': return '✅'
      case 'disconnected': return '❌'
      case 'error': return '⚠️'
      default: return '❓'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'text-green-600'
      case 'disconnected': return 'text-red-600'
      case 'error': return 'text-yellow-600'
      default: return 'text-gray-600'
    }
  }

  return (
    <div className="space-y-4">
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">Database Diagnostics</h3>
        
        {/* Connection Status */}
        <div className="mb-4">
          <div className="flex items-center space-x-2 mb-2">
            <span className={getStatusColor(diagnostics.connectionStatus)}>
              {getStatusIcon(diagnostics.connectionStatus)}
            </span>
            <span className="font-medium">Connection Status</span>
            <span className={getStatusColor(diagnostics.connectionStatus)}>
              {diagnostics.connectionStatus}
            </span>
          </div>
        </div>

        {/* Available Tables */}
        <div className="mb-4">
          <div className="flex items-center space-x-2 mb-2">
            <span className="text-blue-600">📊</span>
            <span className="font-medium">Available Tables</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {diagnostics.tablesAvailable.length > 0 ? (
              diagnostics.tablesAvailable.map(table => (
                <span key={table} className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm">
                  {table}
                </span>
              ))
            ) : (
              <span className="text-red-600 text-sm">No tables accessible</span>
            )}
          </div>
        </div>

        {/* Data Availability */}
        <div className="mb-4">
          <div className="flex items-center space-x-2 mb-2">
            <span className="text-purple-600">📈</span>
            <span className="font-medium">Data Availability</span>
          </div>
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className={diagnostics.userDataExists ? 'text-green-600' : 'text-red-600'}>
                {diagnostics.userDataExists ? '✅' : '❌'}
              </span>
              <span className="text-sm">User games data</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className={diagnostics.analysisDataExists ? 'text-green-600' : 'text-red-600'}>
                {diagnostics.analysisDataExists ? '✅' : '❌'}
              </span>
              <span className="text-sm">Analysis data</span>
            </div>
            {diagnostics.mockDataDetected && (
              <div className="flex items-center space-x-2">
                <span className="text-yellow-600">⚠️</span>
                <span className="text-sm text-yellow-600">Mock data detected</span>
              </div>
            )}
          </div>
        </div>

        {/* Analysis Types */}
        {analysisTypes && (
          <div className="mb-4">
            <div className="flex items-center space-x-2 mb-2">
              <span className="text-indigo-600">🔬</span>
              <span className="font-medium">Analysis Types</span>
            </div>
            <div className="space-y-1">
              {Object.entries(analysisTypes).map(([type, data]) => (
                <div key={type} className="flex items-center justify-between">
                  <span className="text-sm">{type}</span>
                  <div className="flex items-center space-x-2">
                    <span className={data.exists ? 'text-green-600' : 'text-red-600'}>
                      {data.exists ? '✅' : '❌'}
                    </span>
                    <span className="text-sm text-gray-600">({data.count})</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* User ID Variations Test */}
        {userVariations && (
          <div className="mb-4">
            <div className="flex items-center space-x-2 mb-2">
              <span className="text-purple-600">🔍</span>
              <span className="font-medium">User ID Variations Test</span>
            </div>
            <div className="space-y-2">
              {Object.entries(userVariations).map(([variation, data]: [string, any]) => (
                <div key={variation} className="p-2 bg-gray-50 rounded text-sm">
                  <div className="font-mono text-xs text-gray-600 mb-1">"{variation}"</div>
                  <div className="grid grid-cols-4 gap-2 text-xs">
                    <div>Games: {data.games?.count || 0}</div>
                    <div>Game Analyses: {data.gameAnalyses?.count || 0}</div>
                    <div>Move Analyses: {data.moveAnalyses?.count || 0}</div>
                    <div>Unified: {data.unified?.count || 0}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* All Users in Database */}
        {allUsers && (
          <div className="mb-4">
            <div className="flex items-center space-x-2 mb-2">
              <span className="text-indigo-600">👥</span>
              <span className="font-medium">All Users in Database</span>
            </div>
            <div className="space-y-2 text-sm">
              <div>Games table: {allUsers.gamesUsers?.length || 0} users</div>
              <div>Game analyses: {allUsers.gameAnalysesUsers?.length || 0} users</div>
              <div>Move analyses: {allUsers.moveAnalysesUsers?.length || 0} users</div>
              {allUsers.gamesUsers && allUsers.gamesUsers.length > 0 && (
                <div className="mt-2">
                  <div className="text-xs text-gray-600 mb-1">Sample users from games table:</div>
                  <div className="font-mono text-xs bg-gray-100 p-2 rounded">
                    {allUsers.gamesUsers.slice(0, 5).join(', ')}
                    {allUsers.gamesUsers.length > 5 && ` ... and ${allUsers.gamesUsers.length - 5} more`}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Unified View Test */}
        {unifiedViewTest && (
          <div className="mb-4">
            <div className="flex items-center space-x-2 mb-2">
              <span className="text-cyan-600">🔬</span>
              <span className="font-medium">Unified View Test</span>
            </div>
            <div className="space-y-2 text-sm">
              {Object.entries(unifiedViewTest).map(([type, data]: [string, any]) => (
                <div key={type} className="flex justify-between">
                  <span>{type}:</span>
                  <span className={data.count > 0 ? 'text-green-600' : 'text-red-600'}>
                    {data.count} records
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recommendations */}
        {diagnostics.recommendations.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center space-x-2 mb-2">
              <span className="text-orange-600">💡</span>
              <span className="font-medium">Recommendations</span>
            </div>
            <ul className="space-y-1">
              {diagnostics.recommendations.map((rec, index) => (
                <li key={index} className="text-sm text-gray-700 flex items-start space-x-2">
                  <span className="text-orange-600 mt-0.5">•</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <button
          onClick={runDiagnostics}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
        >
          Refresh Diagnostics
        </button>
      </div>
    </div>
  )
}

export default DatabaseDiagnosticsComponent
