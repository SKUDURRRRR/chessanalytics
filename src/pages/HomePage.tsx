// Home Page - Entry point with player search
import { PlayerSearch } from '../components/simple/PlayerSearch'

export default function HomePage() {
  const handlePlayerSelect = (userId: string, platform: 'lichess' | 'chess.com') => {
    // Redirect directly to the full user profile page
    window.location.href = `/simple-analytics?user=${userId}&platform=${platform}`
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.18),_transparent_45%),radial-gradient(circle_at_bottom,_rgba(14,116,144,0.2),_transparent_40%)]" />
      <div className="relative container-responsive space-responsive py-8 sm:py-12 md:py-16">
        {/* Logo in top left */}
        <div className="absolute top-4 left-4 sm:top-6 sm:left-6">
          <img
            src="/chesdata.svg"
            alt="Chess Analytics"
            className="h-10 w-auto sm:h-12 opacity-90 hover:opacity-100 transition-opacity"
          />
        </div>

        <header className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1 text-xs uppercase tracking-wide text-slate-300 shadow-md shadow-cyan-500/10">
            Precision Chess Insights
          </div>
          <h1 className="mt-6 text-fluid-4xl font-semibold leading-tight text-white">
            Understand your moves with chess data
          </h1>
          <p className="mt-4 text-fluid-base text-slate-300">
            Explore match histories, uncover openings that win for you, and run deep Stockfish reviews in a single, streamlined space.
          </p>
        </header>

        <div className="card-responsive">
          <PlayerSearch onPlayerSelect={handlePlayerSelect} />
          <p className="mt-3 text-xs text-slate-400">
            Works for players on Lichess and Chess.com. No account required.
          </p>
        </div>

        {/* Feature blocks centered horizontally */}
        <div className="mt-24 mb-16 flex justify-center">
          <section className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 max-w-6xl">
            {[{
              title: 'Instant Profiles',
              description: 'Jump directly into head-to-head stats, win streaks, and rating momentum.'
            }, {
              title: 'Engine-Guided Review',
              description: 'Queue Stockfish analysis for any game and see accuracy, blunders, and centipawn swings.'
            }, {
              title: 'Opening Radar',
              description: 'Spot the openings you score best with and filter recent games to focus your study.'
            }].map((card) => (
              <article
                key={card.title}
                className="group relative overflow-hidden card-responsive transition duration-300 hover:border-white/20 hover:bg-white/[0.12]"
              >
                <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-sky-400/20 blur-2xl transition duration-300 group-hover:bg-sky-400/30" />
                <h3 className="text-xl font-semibold text-white">{card.title}</h3>
                <p className="mt-3 text-sm text-slate-300">{card.description}</p>
                <span className="mt-6 inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-sky-300">
                  Explore
                  <span aria-hidden className="h-px w-6 bg-sky-400/70" />
                </span>
              </article>
            ))}
          </section>
        </div>
      </div>
    </div>
  )
}
