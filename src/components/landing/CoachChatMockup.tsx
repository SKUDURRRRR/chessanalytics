import { Chessboard } from 'react-chessboard'
import { getDarkChessBoardTheme } from '../../utils/chessBoardTheme'

export function CoachChatMockup() {
  const fen = 'r1bqkb1r/ppp1ppp1/3p1n1p/8/2B1P3/3P4/PPP2PPP/RNBQK1NR w KQkq - 0 4'

  const messages = [
    {
      role: 'user' as const,
      text: 'Why was Bc4 rated "Good" instead of "Best"?',
    },
    {
      role: 'coach' as const,
      text: 'Bc4 is a solid developing move, but the engine slightly prefers Nc3 here. Nc3 develops a piece while keeping more tension — Bc4 commits the bishop early and can be challenged by ...Na5. Still a perfectly playable choice.',
    },
    {
      role: 'user' as const,
      text: 'What should I focus on next?',
    },
    {
      role: 'coach' as const,
      text: 'Castle kingside to secure your king, then look for f4 or Nc3-d5 plans. The h6 weakness gives you long-term attacking chances on the kingside.',
    },
  ]

  return (
    <div className="bg-surface-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: 'auto 1fr', minHeight: 380 }}>

      {/* Top-left: Move name + badge (right-aligned, between board and chat) */}
      <div style={{ padding: '12px 8px 0 20px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#f0f0f0' }}>h6</span>
        <span style={{ fontSize: 9, fontWeight: 600, color: '#fff', background: '#06b6d4', borderRadius: 9999, padding: '2px 8px' }}>Excellent</span>
      </div>

      {/* Top-right: Coach header */}
      <div style={{ borderLeft: '1px solid rgba(255,255,255,0.04)', padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(228,232,237,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#9ca3af' }}>&#9813;</div>
        <span style={{ fontSize: 13, fontWeight: 500, color: '#f0f0f0' }}>Coach Tal</span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#34d399' }} />
          <span style={{ fontSize: 10, color: '#4b5563' }}>Online</span>
        </div>
      </div>

      {/* Bottom-left: Board + centered arrows */}
      <div style={{ padding: '8px 0 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 320 }}>
          <Chessboard
            id="coach-chat-mockup-board"
            position={fen}
            arePiecesDraggable={false}
            boardWidth={320}
            showBoardNotation={false}
            {...getDarkChessBoardTheme('default')}
          />

          {/* Navigation arrows — pinned to board width, centered */}
          <div style={{ marginTop: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, paddingLeft: 16 }}>
            {['<<', '<', '>', '>>'].map(b => (
              <span key={b} style={{ fontSize: 10, color: '#6b7280', background: 'rgba(255,255,255,0.06)', borderRadius: 4, padding: '4px 10px' }}>{b}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom-right: Chat messages + input */}
      <div style={{ borderLeft: '1px solid rgba(255,255,255,0.04)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
        {/* Messages */}
        <div style={{ padding: '12px 16px', overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {messages.map((msg, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '88%',
                borderRadius: 8,
                padding: '8px 12px',
                fontSize: 11,
                lineHeight: '1.6',
                background: msg.role === 'user' ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.04)',
                color: msg.role === 'user' ? '#93c5fd' : '#d1d5db',
              }}>
                {msg.text}
              </div>
            </div>
          ))}
        </div>

        {/* Quick suggestions */}
        <div style={{ padding: '8px 16px', borderTop: '1px solid rgba(255,255,255,0.04)', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {['Why was this bad?', 'Best continuation?', 'Explain this opening'].map(s => (
            <span key={s} style={{ fontSize: 10, color: '#6b7280', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 4, padding: '3px 8px' }}>{s}</span>
          ))}
        </div>

        {/* Input */}
        <div style={{ padding: '10px 16px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          <div style={{ background: '#1c1d20', borderRadius: 6, padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 0 0 1px rgba(255,255,255,0.04)' }}>
            <span style={{ fontSize: 11, color: '#4b5563' }}>Ask about this position...</span>
            <span style={{ fontSize: 11, color: '#9ca3af', background: 'rgba(255,255,255,0.06)', borderRadius: 4, padding: '1px 6px' }}>&#8593;</span>
          </div>
        </div>
      </div>
    </div>
  )
}
