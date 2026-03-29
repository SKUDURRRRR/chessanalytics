import { DeepAnalysisData } from '../../services/unifiedAnalysisService'

interface LongTermPlannerProps {
  data: DeepAnalysisData
  userId: string
}

export function LongTermPlanner({ data, userId }: LongTermPlannerProps) {
  if (!data) {
    return (
      <div className="rounded-lg bg-[#151618] shadow-card p-[18px_20px]">
        <div className="text-[12px] font-medium uppercase tracking-[0.07em] text-[#5a6270] mb-3.5">{userId}&apos;s Game Style</div>
        <p className="text-xs text-[#3a4250]">Loading analysis data...</p>
      </div>
    )
  }

  const aiStyle = data.ai_style_analysis

  return (
    <div className="rounded-lg bg-[#151618] shadow-card p-[18px_20px]">
      <div className="text-[12px] font-medium uppercase tracking-[0.07em] text-[#5a6270] mb-3.5">{userId}&apos;s Game Style</div>

      {/* Style Intro */}
      {aiStyle?.style_summary ? (
        <div className="text-[13px] text-[#5a6270] leading-relaxed mb-3.5 p-3.5 bg-white/[0.02] rounded-lg">
          <span dangerouslySetInnerHTML={{
            __html: aiStyle.style_summary
              .replace(/\*\*(.*?)\*\*/g, '<strong class="text-[#8a9299] font-medium">$1</strong>')
          }} />
        </div>
      ) : (
        <div className="text-[13px] text-[#5a6270] leading-relaxed mb-3.5 p-3.5 bg-white/[0.02] rounded-lg">
          You are a <strong className="text-[#8a9299] font-medium">{data.player_level || 'Unknown'}</strong> player with <strong className="text-[#8a9299] font-medium">{data.total_games || 0} games analyzed</strong>.
          {data.playing_style && (
            <span className="block mt-1 italic text-[#4a5260]">&ldquo;{data.playing_style}&rdquo;</span>
          )}
        </div>
      )}

      {/* 2x2 Style Quadrants */}
      {aiStyle && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="bg-white/[0.02] rounded-lg p-3.5">
            <div className="text-xs font-medium text-[#8a9299] mb-1.5">Key Characteristics</div>
            <div className="text-xs text-[#4a5260] leading-relaxed">{aiStyle.characteristics || 'See style summary for details.'}</div>
          </div>
          <div className="bg-white/[0.02] rounded-lg p-3.5">
            <div className="text-xs font-medium text-[#8a9299] mb-1.5">Main Strengths</div>
            <div className="text-xs text-[#4a5260] leading-relaxed">{aiStyle.strengths || 'See style summary for details.'}</div>
          </div>
          <div className="bg-white/[0.02] rounded-lg p-3.5">
            <div className="text-xs font-medium text-[#8a9299] mb-1.5">Playing Patterns</div>
            <div className="text-xs text-[#4a5260] leading-relaxed">{aiStyle.playing_patterns || 'See style summary for details.'}</div>
          </div>
          <div className="bg-white/[0.02] rounded-lg p-3.5">
            <div className="text-xs font-medium text-[#8a9299] mb-1.5">Improvement Focus</div>
            <div className="text-xs text-[#4a5260] leading-relaxed">{aiStyle.improvement_focus || 'See style summary for details.'}</div>
          </div>
        </div>
      )}
    </div>
  )
}
