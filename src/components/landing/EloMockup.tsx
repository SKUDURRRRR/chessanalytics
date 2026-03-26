export function EloMockup() {
  // Chart data - 25 points showing upward trend from 1404 to 1500
  const ratings = [1404, 1408, 1404, 1415, 1410, 1418, 1425, 1420, 1430, 1428, 1432, 1440, 1435, 1445, 1450, 1455, 1460, 1458, 1465, 1460, 1472, 1478, 1482, 1492, 1500]
  const results: ('w' | 'l' | 'd')[] = ['d', 'w', 'l', 'w', 'l', 'w', 'w', 'l', 'w', 'l', 'w', 'w', 'l', 'w', 'w', 'w', 'w', 'l', 'w', 'l', 'w', 'w', 'w', 'w', 'w']

  const minR = 1398, maxR = 1510
  const pL = 32, pR = 8, pT = 12, pB = 20
  const W = 440, H = 190
  const cW = W - pL - pR, cH = H - pT - pB

  const toX = (i: number) => pL + (i / (ratings.length - 1)) * cW
  const toY = (r: number) => pT + cH - ((r - minR) / (maxR - minR)) * cH

  const line = ratings.map((r, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(r).toFixed(1)}`).join(' ')
  const area = line + ` L${toX(ratings.length - 1).toFixed(1)},${(pT + cH).toFixed(1)} L${toX(0).toFixed(1)},${(pT + cH).toFixed(1)} Z`
  const yTicks = [1404, 1429, 1454, 1479, 1500]

  return (
    <div className="rounded-lg shadow-card bg-surface-1 p-4 text-white" style={{ fontSize: '10px' }}>
      <h3 className="mb-4 text-sm font-semibold text-white">Recent Performance</h3>

      <div className="grid gap-3" style={{ gridTemplateColumns: '150px 1fr' }}>
        {/* Left - Stat Cards */}
        <div className="flex flex-col gap-3">
          <div className="rounded-lg shadow-card bg-white/[0.03] p-3 flex-1">
            <span className="text-[8px] uppercase tracking-wide text-gray-500">Recent Win Rate</span>
            <div className="text-sm font-semibold text-emerald-300 mt-0.5">58.0%</div>
            <div className="mt-1 text-[7px] text-gray-500">50 games &bull; Rapid</div>
          </div>
          <div className="rounded-lg shadow-card bg-white/[0.03] p-3 flex-1">
            <span className="text-[8px] uppercase tracking-wide text-gray-500">Current Rating</span>
            <div className="text-sm font-semibold text-sky-300 mt-0.5">1500</div>
            <div className="mt-1 text-[7px] text-gray-500">Avg: 1440 &bull; 50 games</div>
          </div>
          <div className="rounded-lg shadow-card bg-white/[0.03] p-3 flex-1">
            <span className="text-[8px] uppercase tracking-wide text-gray-500">Most Played Opening</span>
            <div className="text-xs font-semibold text-purple-300 leading-tight mt-1">Pirc Defense</div>
            <div className="mt-1 text-[7px] text-gray-500">150 games &bull; Rapid</div>
          </div>
        </div>

        {/* Right - Chart */}
        <div className="min-w-0 flex flex-col">
          {/* Filters */}
          <div className="mb-2 flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <label className="text-[8px] font-medium uppercase tracking-wide text-gray-500">Time Control</label>
              <span className="rounded-full shadow-card bg-surface-2/50 px-2 py-0.5 text-[8px] text-gray-300">Rapid (297 games) &#9662;</span>
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-[8px] font-medium uppercase tracking-wide text-gray-500">Show Games</label>
              <span className="rounded-full shadow-card bg-surface-2/50 px-2 py-0.5 text-[8px] text-gray-300">Last 50 &#9662;</span>
            </div>
          </div>

          {/* Chart Card */}
          <div className="overflow-hidden rounded-lg shadow-card bg-white/[0.04] flex-1 flex flex-col">
            <div className="p-3 flex-1">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-semibold text-white">ELO Trend</h3>
                  <p className="text-[7px] uppercase tracking-wide text-gray-500">Rapid (297 Games)</p>
                </div>
                <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[7px] font-semibold uppercase tracking-wide text-white">
                  Improving
                </span>
              </div>

              <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block">
                <defs>
                  <linearGradient id="mockEloGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#059669" stopOpacity="0.12" />
                    <stop offset="100%" stopColor="#059669" stopOpacity="0.04" />
                  </linearGradient>
                </defs>
                {/* Dashed grid lines */}
                {yTicks.map(r => (
                  <g key={r}>
                    <line x1={pL} y1={toY(r)} x2={W - pR} y2={toY(r)} stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" strokeDasharray="3 3" />
                    <text x={pL - 3} y={toY(r) + 2.5} fill="rgba(226,232,240,0.5)" fontSize="6" textAnchor="end">{r}</text>
                  </g>
                ))}
                {/* X axis labels */}
                {ratings.map((_, i) => i % 2 === 0 ? (
                  <text key={i} x={toX(i)} y={H - 4} fill="rgba(226,232,240,0.5)" fontSize="5.5" textAnchor="middle">#{i + 1}</text>
                ) : null)}
                {/* Area gradient */}
                <path d={area} fill="url(#mockEloGrad)" />
                {/* Line */}
                <path d={line} fill="none" stroke="#059669" strokeWidth="1.8" strokeLinejoin="round" />
                {/* Dots - hollow with colored stroke like Recharts */}
                {ratings.map((r, i) => {
                  const color = results[i] === 'w' ? '#059669' : results[i] === 'l' ? '#dc2626' : '#6b7280'
                  return (
                    <g key={i}>
                      <circle cx={toX(i)} cy={toY(r)} r="3.5" fill="#fff" stroke={color} strokeWidth="2" />
                      <circle cx={toX(i)} cy={toY(r)} r="1.8" fill={color} />
                    </g>
                  )
                })}
              </svg>
            </div>

            {/* Chart footer */}
            <div className="border-t border-white/10 bg-white/[0.03] px-3 py-2 text-[7px] text-gray-500">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center rounded-full shadow-card bg-white/10 px-1.5 py-0.5 text-[7px] font-semibold text-gray-300">
                    Upward trend
                  </span>
                  <span>Average rating: <span className="font-semibold text-white">1440</span></span>
                </div>
                <span className="text-gray-400 font-semibold">1500</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Range: 1404 - 1500</span>
                <span>50 key points</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
