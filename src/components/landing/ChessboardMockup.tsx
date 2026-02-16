import { Chessboard } from 'react-chessboard'
import { getDarkChessBoardTheme } from '../../utils/chessBoardTheme'

export function ChessboardMockup() {
  // Position after 1.e4 d6 2.d4 Nf6 3.Bc4 h6 (Pirc Defense)
  const fen = 'r1bqkb1r/ppp1ppp1/3p1n1p/8/2B1P3/3P4/PPP2PPP/RNBQK1NR w KQkq - 0 4'

  const sqSize = 40
  const boardPx = sqSize * 8

  // Arrow from c4 to f7 (bishop diagonal)
  const arrowFrom = { col: 2, row: 4 }
  const arrowTo = { col: 5, row: 1 }
  const ax1 = arrowFrom.col * sqSize + sqSize / 2
  const ay1 = arrowFrom.row * sqSize + sqSize / 2
  const ax2 = arrowTo.col * sqSize + sqSize / 2
  const ay2 = arrowTo.row * sqSize + sqSize / 2

  // Arrow head calc
  const angle = Math.atan2(ay2 - ay1, ax2 - ax1)
  const headLen = 16, headW = 10
  const hp1x = ax2 - headLen * Math.cos(angle) - headW * Math.sin(angle)
  const hp1y = ay2 - headLen * Math.sin(angle) + headW * Math.cos(angle)
  const hp2x = ax2 - headLen * Math.cos(angle) + headW * Math.sin(angle)
  const hp2y = ay2 - headLen * Math.sin(angle) - headW * Math.cos(angle)
  const shortenX = ax2 - headLen * Math.cos(angle)
  const shortenY = ay2 - headLen * Math.sin(angle)

  const moves = [
    { num: 3, you: 'Bc4', youClass: 'good', opp: 'Nf6', oppClass: 'best' },
    { num: 4, you: 'd3', youClass: 'excellent', opp: 'h6', oppClass: 'excellent' },
    { num: 5, you: 'a3', youClass: 'good', opp: 'Bc5', oppClass: 'best' },
  ]

  const classColors: Record<string, string> = {
    brilliant: 'border-purple-400/40 bg-purple-500/20 text-purple-200',
    best: 'border-emerald-400/40 bg-emerald-500/20 text-emerald-200',
    excellent: 'border-cyan-400/40 bg-cyan-500/20 text-cyan-200',
    good: 'border-sky-400/40 bg-sky-500/20 text-sky-200',
    inaccuracy: 'border-amber-400/40 bg-amber-500/20 text-amber-200',
    mistake: 'border-orange-400/40 bg-orange-500/20 text-orange-200',
    blunder: 'border-rose-400/40 bg-rose-500/20 text-rose-200',
  }

  const classLabels: Record<string, string> = {
    brilliant: 'Brilliant', best: 'Best', excellent: 'Excellent', good: 'Good',
    inaccuracy: 'Inaccuracy', mistake: 'Mistake', blunder: 'Blunder',
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-4 shadow-lg shadow-black/40 text-white" style={{ fontSize: '10px' }}>
      {/* Opening Phase badge */}
      <div className="flex justify-center mb-3">
        <span className="rounded-full border border-slate-700/50 bg-slate-800/40 px-2.5 py-0.5 text-[8px] font-semibold text-blue-400 uppercase tracking-wide">
          Opening Phase
        </span>
      </div>

      <div className="flex gap-3 items-start">
        {/* Left - Board with eval bar */}
        <div className="shrink-0">
          <div className="flex gap-1">
            {/* Eval bar */}
            <div className="relative overflow-hidden rounded-lg border border-slate-700 shadow-lg" style={{ width: 16, height: boardPx }}>
              <div className="absolute top-0 left-0 right-0 bg-slate-900" style={{ height: '45%' }} />
              <div className="absolute bottom-0 left-0 right-0 bg-white" style={{ height: '55%' }} />
              <div className="absolute left-0 right-0 flex justify-center" style={{ top: '45%', zIndex: 20 }}>
                <span className="block h-[3px] w-full bg-orange-400" style={{ boxShadow: '0 0 8px rgba(251,146,60,0.8), 0 0 4px rgba(251,146,60,0.6)' }} />
              </div>
            </div>

            {/* Board */}
            <div className="relative" style={{ width: boardPx, height: boardPx }}>
              <Chessboard
                id="landing-mockup-board"
                position={fen}
                arePiecesDraggable={false}
                boardWidth={boardPx}
                showBoardNotation={true}
                {...getDarkChessBoardTheme('default')}
              />

              {/* Arrow overlay */}
              <svg className="absolute inset-0 pointer-events-none" style={{ width: boardPx, height: boardPx }}>
                <defs>
                  <filter id="mockArrowGlow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                    <feMerge>
                      <feMergeNode in="coloredBlur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                <path
                  d={`M ${ax1},${ay1} L ${shortenX},${shortenY}`}
                  stroke="#10b981" strokeWidth="7" strokeLinecap="round" fill="none" opacity="0.85"
                  filter="url(#mockArrowGlow)"
                />
                <polygon
                  points={`${ax2},${ay2} ${hp1x},${hp1y} ${hp2x},${hp2y}`}
                  fill="#10b981" opacity="0.95"
                />
              </svg>
            </div>
          </div>

          {/* Navigation */}
          <div className="text-center mt-2">
            <div className="text-[7px] text-slate-500 mb-1">Use &larr; &rarr; arrow keys or click buttons to navigate</div>
            <div className="flex items-center justify-center gap-1">
              {['<<', '<', '>', '>>'].map(b => (
                <span key={b} className="rounded-md border border-white/10 bg-white/10 px-2 py-0.5 text-[8px] text-slate-200">
                  {b}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Right - Analysis Panel */}
        <div className="flex-1 min-w-0">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3.5 shadow-xl shadow-black/40 h-full flex flex-col">
            {/* Current Move */}
            <div className="mb-2.5">
              <h3 className="text-[8px] font-semibold uppercase tracking-wide text-slate-400">Current Move</h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xl font-semibold text-white leading-none">h6</span>
                <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[7px] font-semibold border ${classColors['excellent']}`}>
                  Excellent
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1 text-[7px] text-slate-400 uppercase tracking-wide">
                <span>Opponent Move</span>
                <span className="h-px w-5 bg-white/20" />
                <span>Move 4</span>
              </div>
            </div>

            {/* Move Analysis */}
            <div className="bg-gradient-to-r from-slate-800/50 to-slate-700/50 p-2.5 rounded-lg border-l-4 border-sky-400 mb-2.5">
              <div className="text-[9px] font-semibold text-white mb-1">Move Analysis</div>
              <p className="text-[7.5px] text-slate-200 leading-relaxed">
                This position is sharp and tense. Black has given up some central control to improve the placement of his knight on f6, but this weakens his kingside pawns. White must carefully weigh the pros and cons of an immediate pawn storm versus a more patient approach to exploit these structural weaknesses.
              </p>
            </div>

            {/* Follow-Up button */}
            <button className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-1.5 text-[8px] font-medium text-emerald-300 mb-2.5">
              &rarr; Show Follow-Up
            </button>

            {/* Divider */}
            <div className="h-px bg-gradient-to-r from-transparent via-white/20 to-transparent mb-2.5" />

            {/* Move Timeline */}
            <div className="flex-1">
              <h3 className="text-[8px] font-semibold uppercase tracking-wide text-slate-400">Move Timeline</h3>
              <div className="text-[7px] text-slate-500 mt-0.5 mb-2">&larr; &rarr; to navigate moves &bull; Scroll to see all moves</div>

              <table className="w-full table-fixed text-left">
                <thead>
                  <tr className="text-[7px] uppercase text-slate-400">
                    <th className="w-8 py-1">Move</th>
                    <th className="py-1">You</th>
                    <th className="py-1">Opponent</th>
                  </tr>
                </thead>
                <tbody>
                  {moves.map(m => (
                    <tr key={m.num} className="border-b border-white/5 last:border-b-0">
                      <td className="py-1 text-[8px] text-slate-400">{m.num}</td>
                      <td className="py-1 pr-1">
                        <div className={`flex items-center justify-between rounded-lg px-1.5 py-1 ${m.num === 4 ? 'bg-white/20 text-white ring-1 ring-white/10' : 'bg-white/[0.06] text-slate-200'}`}>
                          <span className="text-[8px] font-medium">{m.you}</span>
                          <span className={`inline-flex items-center rounded-full px-1 py-0.5 text-[6px] font-semibold border ${classColors[m.youClass]}`}>
                            {classLabels[m.youClass]}
                          </span>
                        </div>
                      </td>
                      <td className="py-1 pl-1">
                        <div className={`flex items-center justify-between rounded-lg px-1.5 py-1 ${m.num === 4 ? 'bg-white/20 text-white ring-1 ring-white/10' : 'bg-white/[0.06] text-slate-200'}`}>
                          <span className="text-[8px] font-medium">{m.opp}</span>
                          <span className={`inline-flex items-center rounded-full px-1 py-0.5 text-[6px] font-semibold border ${classColors[m.oppClass]}`}>
                            {classLabels[m.oppClass]}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
