import { Chessboard } from 'react-chessboard'
import { getDarkChessBoardTheme } from '../../utils/chessBoardTheme'

export function ChessboardMockup() {
  // Position after 1.e4 d6 2.d4 Nf6 3.Bc4 h6 (Pirc Defense)
  const fen = 'r1bqkb1r/ppp1ppp1/3p1n1p/8/2B1P3/3P4/PPP2PPP/RNBQK1NR w KQkq - 0 4'

  const boardPx = 300

  const moves = [
    { num: 1, you: 'e4', youClass: 'best', opp: 'd6', oppClass: 'good' },
    { num: 2, you: 'd4', youClass: 'excellent', opp: 'Nf6', oppClass: 'best' },
    { num: 3, you: 'Bc4', youClass: 'good', opp: 'h6', oppClass: 'excellent' },
  ]

  const badgeColor: Record<string, string> = {
    best: 'bg-emerald-500 text-white',
    excellent: 'bg-cyan-500 text-white',
    good: 'bg-sky-500 text-white',
    inaccuracy: 'bg-amber-500 text-white',
    mistake: 'bg-orange-500 text-white',
    blunder: 'bg-rose-500 text-white',
  }

  const badgeLabel: Record<string, string> = {
    best: 'Best', excellent: 'Excellent', good: 'Good',
    inaccuracy: 'Inaccuracy', mistake: 'Mistake', blunder: 'Blunder',
  }

  return (
    <div className="text-white" style={{ fontSize: '10px' }}>
      {/* Board + Analysis Panel */}
      <div className="flex gap-5 p-5">
        {/* Left: Eval bar + Board */}
        <div className="shrink-0">
          <div className="flex gap-1.5">
            {/* Eval bar */}
            <div className="relative overflow-hidden rounded" style={{ width: 16, height: boardPx }}>
              <div className="absolute inset-x-0 top-0 bg-slate-800" style={{ height: '45%' }} />
              <div className="absolute inset-x-0 bottom-0 bg-white" style={{ height: '55%' }} />
              <div className="absolute inset-x-0" style={{ top: '45%' }}>
                <span className="block h-[2px] w-full bg-orange-400" style={{ boxShadow: '0 0 6px rgba(251,146,60,0.8)' }} />
              </div>
            </div>

            {/* Board */}
            <div style={{ width: boardPx, height: boardPx }}>
              <Chessboard
                id="landing-mockup-board"
                position={fen}
                arePiecesDraggable={false}
                boardWidth={boardPx}
                showBoardNotation={true}
                customArrows={[['c4', 'f7', 'rgb(16, 185, 129)']]}
                {...getDarkChessBoardTheme('default')}
              />
            </div>
          </div>

          {/* Nav hint + buttons */}
          <div className="text-center mt-2.5">
            <div className="text-[7px] text-slate-500 mb-1">Use &larr; &rarr; arrow keys or click buttons to navigate</div>
            <div className="flex items-center justify-center gap-1.5">
              {['<<', '<', '>', '>>'].map(b => (
                <span key={b} className="rounded border border-white/10 bg-white/10 px-2 py-0.5 text-[8px] text-slate-300">
                  {b}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Current Move + Move Timeline */}
        <div className="flex-1 min-w-0">
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4 h-full flex flex-col">
            {/* Current Move */}
            <div className="text-[8px] font-semibold uppercase tracking-wide text-slate-400">Current Move</div>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-xl font-semibold text-white leading-none">h6</span>
              <span className={`rounded-full px-2 py-0.5 text-[7px] font-bold ${badgeColor['excellent']}`}>
                Excellent
              </span>
            </div>

            {/* Move Analysis */}
            <div className="mt-3 bg-slate-800/60 rounded-lg p-3 border-l-2 border-sky-400">
              <div className="text-[9px] font-semibold text-white mb-1">Move Analysis</div>
              <p className="text-[7.5px] text-slate-300 leading-relaxed">
                This position is sharp. Black has given up central control for piece play with Nf6, but h6 weakens the kingside.
              </p>
            </div>

            {/* Follow-Up */}
            <button className="mt-2.5 w-full rounded-lg border border-emerald-400/30 bg-emerald-500/10 py-1.5 text-[8px] font-medium text-emerald-300">
              &rarr; Show Follow-Up
            </button>

            {/* Divider */}
            <div className="h-px bg-white/10 my-3" />

            {/* Move Timeline */}
            <div className="text-[8px] font-semibold uppercase tracking-wide text-slate-400">Move Timeline</div>
            <div className="text-[6px] text-slate-500 mt-0.5 mb-2">&larr; &rarr; to navigate moves</div>

            <table className="w-full table-fixed text-left">
              <thead>
                <tr className="text-[7px] uppercase text-slate-500">
                  <th className="w-8 py-1">Move</th>
                  <th className="py-1">You</th>
                  <th className="py-1">Opponent</th>
                </tr>
              </thead>
              <tbody>
                {moves.map(m => (
                  <tr key={m.num} className="border-b border-white/5 last:border-b-0">
                    <td className="py-1 text-[8px] text-slate-400">{m.num}</td>
                    <td className="py-1 pr-1.5">
                      <div className="flex items-center justify-between rounded-lg px-2 py-1 bg-white/[0.06]">
                        <span className="text-[8px] font-medium text-slate-200">{m.you}</span>
                        <span className={`rounded-full px-1.5 py-0.5 text-[6px] font-bold ${badgeColor[m.youClass]}`}>
                          {badgeLabel[m.youClass]}
                        </span>
                      </div>
                    </td>
                    <td className="py-1 pl-1.5">
                      <div className="flex items-center justify-between rounded-lg px-2 py-1 bg-white/[0.06]">
                        <span className="text-[8px] font-medium text-slate-200">{m.opp}</span>
                        <span className={`rounded-full px-1.5 py-0.5 text-[6px] font-bold ${badgeColor[m.oppClass]}`}>
                          {badgeLabel[m.oppClass]}
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

      {/* Opening Analysis - matches real page section */}
      <div className="border-t border-white/10 mx-5 pt-4 pb-5">
        <div className="text-[10px] font-semibold text-white">Opening Analysis</div>
        <div className="text-[9px] text-sky-400 font-medium mt-1">Pirc Defense</div>
        <div className="text-[7px] text-slate-400 mt-0.5">Comprehensive analysis with actionable insights</div>

        <div className="grid grid-cols-4 gap-2.5 mt-3">
          {[
            { value: '8/10', label: 'Theory Knowledge' },
            { value: '83%', label: 'Opening Accuracy' },
            { value: '69%', label: 'Middlegame Accuracy' },
            { value: '71%', label: 'Endgame Accuracy' },
          ].map(stat => (
            <div key={stat.label} className="rounded-lg border border-white/10 bg-white/[0.04] p-2.5">
              <div className="text-[11px] font-bold text-emerald-400">{stat.value}</div>
              <div className="text-[6px] text-slate-400 mt-1 leading-tight">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
