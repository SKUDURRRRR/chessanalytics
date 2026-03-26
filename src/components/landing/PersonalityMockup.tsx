export function PersonalityMockup() {
  const traits = [
    { label: 'Tactical', value: 65, color: 'bg-blue-500' },
    { label: 'Positional', value: 69, color: 'bg-green-500' },
    { label: 'Aggressive', value: 61, color: 'bg-red-500' },
    { label: 'Patient', value: 61, color: 'bg-yellow-500' },
    { label: 'Novelty', value: 50, color: 'bg-purple-500' },
    { label: 'Staleness', value: 56, color: 'bg-orange-500' },
  ]

  // Radar chart geometry
  const cx = 120, cy = 110, maxR = 80
  const angles = traits.map((_, i) => -Math.PI / 2 + (i * 2 * Math.PI) / traits.length)

  const getPoint = (i: number, v: number) => ({
    x: cx + (v / 100) * maxR * Math.cos(angles[i]),
    y: cy + (v / 100) * maxR * Math.sin(angles[i]),
  })

  const ringLevels = [25, 50, 75, 100]
  const dataPath = traits.map((t, i) => {
    const p = getPoint(i, t.value)
    return `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`
  }).join(' ') + ' Z'

  return (
    <div className="rounded-lg shadow-card bg-surface-1 p-4 text-gray-300" style={{ fontSize: '10px' }}>
      <div className="grid grid-cols-2 gap-3">
        {/* Left - Radar */}
        <div className="rounded-lg shadow-card bg-white/[0.04] p-4 flex flex-col">
          <h3 className="mb-2 flex items-center text-xs font-semibold text-white">
            Your Chess Personality Radar
            <span className="ml-1.5 text-[10px] text-gray-500">?</span>
          </h3>

          <svg viewBox="0 0 240 220" className="w-full h-auto block mx-auto" style={{ maxWidth: '210px' }}>
            {/* Grid hexagons */}
            {ringLevels.map(v => {
              const pts = traits.map((_, i) => getPoint(i, v))
              return <polygon key={v} points={pts.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />
            })}
            {/* Axis lines */}
            {traits.map((_, i) => {
              const p = getPoint(i, 100)
              return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />
            })}
            {/* Scale labels */}
            {[25, 50, 75].map(v => {
              const p = getPoint(0, v)
              return <text key={v} x={p.x + 3} y={p.y + 2} fill="rgba(226,232,240,0.5)" fontSize="5">{v}</text>
            })}
            {/* Data polygon */}
            <polygon points={dataPath.replace(' Z', '').replace('M', '').split('L').map(s => s.trim()).join(' ')}
              fill="#38bdf8" fillOpacity="0.25" stroke="#38bdf8" strokeWidth="1.5" />
            {/* Data dots */}
            {traits.map((t, i) => {
              const p = getPoint(i, t.value)
              return <circle key={i} cx={p.x} cy={p.y} r="2.5" fill="#38bdf8" />
            })}
            {/* Axis labels */}
            {traits.map((t, i) => {
              const p = getPoint(i, 120)
              return <text key={i} x={p.x} y={p.y} fill="rgba(226,232,240,0.7)" fontSize="7" textAnchor="middle" dominantBaseline="middle">{t.label}</text>
            })}
          </svg>

          {/* Trait badges grid */}
          <div className="grid grid-cols-3 gap-1.5 mt-auto pt-3">
            {traits.map(t => (
              <div key={t.label} className="flex flex-col items-center rounded-lg shadow-card bg-surface-1 px-2 py-2 text-center">
                <div className={`mb-1 flex h-8 w-8 items-center justify-center rounded-full font-semibold text-white text-[9px] ${t.color} bg-opacity-30`}>
                  {t.value}
                </div>
                <div className="text-[7px] text-gray-400">{t.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right - Opening Analysis */}
        <div className="rounded-lg shadow-card bg-white/[0.04] p-4 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center">
              <div className="mr-2 h-2 w-2 animate-pulse rounded-full bg-sky-300" />
              <h3 className="text-xs font-semibold text-white">Enhanced Opening Analysis</h3>
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold text-white">84%</div>
              <div className="text-[7px] text-gray-400">Opening Win Rate</div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex space-x-1 mb-3 bg-surface-2/50 rounded-xl p-0.5">
            {[{ label: 'Overview', icon: '📊', active: true }, { label: 'Mistakes', icon: '🔴' }, { label: 'Study', icon: '📗' }, { label: 'Progress', icon: '📈' }].map(tab => (
              <span key={tab.label} className={`flex-1 flex items-center justify-center gap-0.5 px-1 py-1 rounded-lg text-[7px] font-medium ${
                tab.active
                  ? 'bg-sky-500 text-white shadow-card'
                  : 'text-gray-500'
              }`}>
                {tab.icon} {tab.label}
              </span>
            ))}
          </div>

          <p className="text-[8px] text-gray-400 leading-relaxed mb-3">
            You're performing well in the opening phase with a 84% win rate across 500 games. Your Queen's Pawn Game is especially strong at 75% win rate.
          </p>

          {/* Playing Style Card */}
          <div className="bg-surface-2 rounded-lg p-2.5 mb-3 shadow-card-highlight">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[7px] text-gray-400 mb-0.5">Your Playing Style</div>
                <div className="text-sm font-semibold text-white">Well-Rounded Player</div>
                <div className="text-[7px] text-sky-300 mt-0.5">Based on positional traits</div>
              </div>
              <div className="text-2xl">&#9823;</div>
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-4 gap-1.5 mb-3">
            {[
              { v: '84%', l: 'Opening Win Rate', color: 'text-white', bg: 'bg-emerald-500/20' },
              { v: '500', l: 'Games Played', color: 'text-emerald-300', bg: 'bg-surface-2/50' },
              { v: '23', l: 'Openings', color: 'text-blue-300', bg: 'bg-surface-2/50' },
              { v: '50%', l: 'Style Match', color: 'text-purple-300', bg: 'bg-surface-2/50' },
            ].map(s => (
              <div key={s.l} className={`${s.bg} rounded-xl p-1.5`}>
                <div className={`text-xs font-semibold ${s.color}`}>{s.v}</div>
                <div className="text-[6px] text-gray-400">{s.l}</div>
              </div>
            ))}
          </div>

          {/* Insight box */}
          <div className="bg-amber-500/10 shadow-card rounded-lg p-2 mt-auto">
            <div className="flex items-start gap-1.5">
              <span className="text-amber-300 text-[10px]">&#127919;</span>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start">
                  <div className="text-[7px] text-gray-300 leading-relaxed">
                    Your positional style (69/100) isn't being fully utilized by your current openings.
                  </div>
                  <span className="text-[9px] font-semibold text-amber-300 shrink-0 ml-1">50%</span>
                </div>
                <p className="text-[7px] text-gray-400 mt-0.5">Your Queen's Pawn Game may not match your positional style, though it has a 75% win rate.</p>
                <p className="text-[7px] text-sky-300 mt-0.5">Prioritize openings that match your positional. See the Study tab for recommendations.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
