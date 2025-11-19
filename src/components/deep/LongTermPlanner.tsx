import { DeepAnalysisData } from '../../services/unifiedAnalysisService'

interface LongTermPlannerProps {
  data: DeepAnalysisData
  userId: string
}

export function LongTermPlanner({ data, userId }: LongTermPlannerProps) {
  // Handle case where data might be null or properties might be undefined
  if (!data) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-slate-200 shadow-xl shadow-black/40">
        <h2 className="mb-4 text-2xl font-semibold text-white">{userId}'s Game Style</h2>
        <p className="text-sm text-slate-300">Loading analysis data...</p>
      </div>
    )
  }

  const primaryPlayer = data.famous_players?.primary
  const aiStyle = data.ai_style_analysis
  const personalityEntries = data.personality_insights ? Object.entries(data.personality_insights).slice(0, 2) : []

  const getConfidenceColor = (confidence?: number) => {
    if (!confidence) return 'text-gray-400'
    if (confidence >= 80) return 'text-emerald-400'
    if (confidence >= 60) return 'text-yellow-400'
    return 'text-gray-400'
  }

  const getConfidenceBadge = (confidence?: number) => {
    if (!confidence) return ''
    if (confidence >= 80) return '●'
    if (confidence >= 60) return '◐'
    return '○'
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-slate-200 shadow-xl shadow-black/40">
      <h2 className="mb-4 text-2xl font-semibold text-white">{userId}'s Game Style</h2>

      <div className="space-y-6">
        {/* AI-Powered Style Analysis */}
        {data.ai_style_analysis ? (
          <div className="rounded-2xl border border-sky-400/30 bg-gradient-to-br from-sky-500/10 via-indigo-500/5 to-transparent p-5">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-sky-200">Style Analysis</h3>
            <div className="space-y-3">
              {data.ai_style_analysis.style_summary && (
                <p className="text-sm text-slate-200">
                  {data.ai_style_analysis.style_summary}
                </p>
              )}

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-4">
                  <h4 className="mb-1 text-sm font-semibold text-white">Key Characteristics</h4>
                  <p className="text-xs text-slate-200">
                    {data.ai_style_analysis.characteristics || 'See style summary for details.'}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-4">
                  <h4 className="mb-1 text-sm font-semibold text-white">Main Strengths</h4>
                  <p className="text-xs text-slate-200">
                    {data.ai_style_analysis.strengths || 'See style summary for details.'}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-4">
                  <h4 className="mb-1 text-sm font-semibold text-white">Playing Patterns</h4>
                  <p className="text-xs text-slate-200">
                    {data.ai_style_analysis.playing_patterns || 'See style summary for details.'}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-4">
                  <h4 className="mb-1 text-sm font-semibold text-white">Improvement Focus</h4>
                  <p className="text-xs text-slate-200">
                    {data.ai_style_analysis.improvement_focus || 'See style summary for details.'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-sky-400/30 bg-gradient-to-br from-sky-500/10 via-indigo-500/5 to-transparent p-5">
            <p className="text-sm text-slate-200">
              You are a <span className="font-semibold text-white">{data.player_level || 'Unknown'}</span> player across <span className="font-semibold text-white">{data.total_games || 0}</span> games.
              {data.playing_style && (
                <span className="mt-2 block italic text-slate-300">
                  "{data.playing_style}"
                </span>
              )}
            </p>
          </div>
        )}

        {/* Personality Insights */}
        {data.personality_insights && (
          <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-5">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-emerald-200">Your Chess Personality Insights</h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {Object.entries(data.personality_insights).map(([trait, insight]) => (
                <div key={trait} className="rounded-2xl border border-white/10 bg-white/[0.05] p-4">
                  <h4 className="mb-1 text-sm font-semibold capitalize text-white">{trait}</h4>
                  <p className="text-xs text-emerald-100">{insight}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Famous Player Comparisons */}
        {primaryPlayer ? (
          <div className="rounded-2xl border border-purple-400/30 bg-purple-500/10 p-5">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-purple-200">Player with Similar Style</h3>

            {/* Primary Match */}
            <div className="rounded-2xl border border-purple-300/40 bg-white/[0.06] p-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center">
                  <div className="mr-2 h-3 w-3 rounded-full bg-purple-400" />
                  <h4 className="text-sm font-semibold text-white">{primaryPlayer.name}</h4>
                </div>
                {primaryPlayer.similarity_score && (
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold ${getConfidenceColor(primaryPlayer.match_confidence)}`}>
                      {getConfidenceBadge(primaryPlayer.match_confidence)} {primaryPlayer.similarity_score.toFixed(0)}% match
                    </span>
                  </div>
                )}
              </div>
              <p className="mb-2 text-xs text-purple-100">{primaryPlayer.description}</p>
              <p className="mb-2 text-[11px] uppercase tracking-wide text-purple-200/80">Era: {primaryPlayer.era}</p>

              {primaryPlayer.insights && primaryPlayer.insights.length > 0 && (
                <div className="mb-3 space-y-2 rounded-2xl border border-purple-300/30 bg-purple-500/15 p-4">
                  <h5 className="text-[11px] font-semibold uppercase tracking-wide text-purple-100">Why this match resonates</h5>
                  <ul className="space-y-2 text-xs text-purple-100">
                    {primaryPlayer.insights.map((line, index) => (
                      <li key={index} className="flex gap-2">
                        <div className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-purple-200" />
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {primaryPlayer.strengths?.map((strength, index) => (
                  <span key={index} className="rounded-full bg-purple-400/20 px-3 py-1 text-[11px] font-medium text-purple-100">
                    {strength}
                  </span>
                ))}
              </div>
            </div>

          </div>
        ) : (
          <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-5 text-xs text-amber-100">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-amber-200">Player with Similar Style</h3>
            <p className="text-xs">Famous player comparison will appear here once analysis is complete.</p>
          </div>
        )}

        {/* Improvement Roadmap */}
        <div className="rounded-2xl border border-sky-400/30 bg-sky-500/10 p-5">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-sky-200">Improvement Roadmap</h3>
          <ul className="space-y-3 text-sm text-slate-200">
            <li className="flex items-start gap-3">
              <div className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-rose-400" />
              <div>
                <span className="font-semibold text-white">Primary Focus:</span>
                <p className="mt-1 text-xs text-slate-200">{data.recommendations?.primary || 'Complete game analysis to get detailed insights'}</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-amber-400" />
              <div>
                <span className="font-semibold text-white">Secondary Focus:</span>
                <p className="mt-1 text-xs text-slate-200">{data.recommendations?.secondary || 'Focus on tactical patterns'}</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-emerald-400" />
              <div>
                <span className="font-semibold text-white">Leverage Strength:</span>
                <p className="mt-1 text-xs text-slate-200">{data.recommendations?.leverage || 'Build on your current strengths'}</p>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}
