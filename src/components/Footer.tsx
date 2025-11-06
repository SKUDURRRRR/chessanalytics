export function Footer() {
  return (
    <footer className="bg-slate-900 border-t border-slate-700 mt-auto">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* chessdata.app badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/40 px-3 py-1 text-xs uppercase tracking-wide text-cyan-100 font-semibold relative overflow-hidden backdrop-blur-md"
               style={{
                 background: 'linear-gradient(135deg, rgba(34, 211, 238, 0.15), rgba(6, 182, 212, 0.25), rgba(8, 145, 178, 0.2))',
                 boxShadow: `
                   0 0 20px rgba(34, 211, 238, 0.3),
                   0 0 40px rgba(6, 182, 212, 0.15),
                   inset 0 1px 1px rgba(255, 255, 255, 0.2),
                   inset 0 -1px 1px rgba(0, 0, 0, 0.2)
                 `,
               }}>
            {/* Liquid shimmer effect */}
            <div className="absolute inset-0 opacity-40"
                 style={{
                   background: 'linear-gradient(45deg, transparent 30%, rgba(255, 255, 255, 0.3) 50%, transparent 70%)',
                   animation: 'liquid-shimmer 3s ease-in-out infinite',
                 }}></div>
            {/* Floating bubble effect */}
            <div className="absolute inset-0 opacity-30"
                 style={{
                   background: 'radial-gradient(circle at 20% 50%, rgba(255, 255, 255, 0.4) 0%, transparent 50%)',
                   animation: 'liquid-bubble 4s ease-in-out infinite',
                 }}></div>
            <span className="relative z-10">chessdata.app</span>
          </div>

          {/* Copyright */}
          <div className="text-slate-400 text-sm">
            © {new Date().getFullYear()} chessdata.app. All rights reserved.
          </div>

          {/* Discord Link */}
          <a
            href="https://discord.gg/S3ymXCeCqK"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 transition-colors"
            title="Join us on Discord"
          >
            <svg
              className="w-5 h-5 text-white"
              fill="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
            </svg>
            <span className="text-sm font-medium text-white">Join us on Discord</span>
          </a>
        </div>
      </div>
    </footer>
  )
}
