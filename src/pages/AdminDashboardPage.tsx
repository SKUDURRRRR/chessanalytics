import { useCallback, useEffect, useState } from 'react'
import {
  Activity,
  AlertCircle,
  Cpu,
  Loader2,
  RefreshCw,
  Search,
  Server,
  Users,
  UserCog,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react'
import {
  AdminService,
  type AdminOverviewResponse,
  type AdminSortOrder,
  type AdminUserDetailResponse,
  type AdminUserRow,
  type AdminUsersSort,
} from '../services/adminService'
import { logger } from '../utils/logger'

const CARD_SHADOW = '0 0 0 1px rgba(255,255,255,0.04), 0 2px 4px rgba(0,0,0,0.2)'
const REFRESH_INTERVAL_MS = 30_000

export default function AdminDashboardPage() {
  const [data, setData] = useState<AdminOverviewResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (initial = false) => {
    if (initial) setLoading(true)
    else setRefreshing(true)
    try {
      const overview = await AdminService.overview()
      setData(overview)
      setError(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load admin overview'
      logger.error('Admin overview load failed:', err)
      setError(message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load(true)
    const interval = setInterval(() => load(false), REFRESH_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [load])

  const isReady = Boolean(data)

  return (
    <div className="min-h-screen bg-surface-base">
      <div className="max-w-6xl mx-auto px-4 md:px-6 pt-8 pb-12">
        <Header
          generatedAt={data?.generated_at ?? null}
          refreshing={refreshing}
          onRefresh={() => load(false)}
        />

        {loading && !data ? (
          <div className="flex items-center justify-center py-24 text-sm text-gray-400">
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Loading platform stats...
          </div>
        ) : error && !data ? (
          <ErrorCard message={error} onRetry={() => load(true)} />
        ) : data ? (
          <div className="space-y-6">
            <SystemSection data={data} />
            <UsersSection data={data} />
            <ActivitySection data={data} />
            <QueueSection data={data} />
            <SubscriptionsSection data={data} />
            <UsersTableSection enabled={isReady} />
            {data.errors.length > 0 && <DataErrorsCard errors={data.errors} />}
          </div>
        ) : null}
      </div>
    </div>
  )
}

interface HeaderProps {
  generatedAt: string | null
  refreshing: boolean
  onRefresh: () => void
}

function Header({ generatedAt, refreshing, onRefresh }: HeaderProps) {
  return (
    <div className="flex items-end justify-between mb-8">
      <div>
        <h1 className="text-title font-semibold text-white tracking-tight">Admin</h1>
        <p className="text-sm text-gray-400 mt-1">
          Platform health and activity
          {generatedAt && (
            <span className="text-gray-500"> · updated {formatTime(generatedAt)}</span>
          )}
        </p>
      </div>
      <button
        type="button"
        onClick={onRefresh}
        disabled={refreshing}
        className="px-3 py-1.5 rounded-md bg-[#1c1d20] text-gray-300 text-xs font-medium hover:bg-[#232428] transition-colors flex items-center gap-2 disabled:opacity-50"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
        Refresh
      </button>
    </div>
  )
}

function SectionHeader({ icon: Icon, title }: { icon: LucideIcon; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className="w-4 h-4 text-gray-400" />
      <h2 className="text-[11px] font-medium text-gray-400 tracking-widest uppercase">
        {title}
      </h2>
    </div>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg p-4" style={{ boxShadow: CARD_SHADOW }}>
      {children}
    </div>
  )
}

function StatTile({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-lg p-3 bg-[#151618]">
      <div className="text-[11px] text-gray-500 uppercase tracking-wider">{label}</div>
      <div className="text-xl font-semibold text-white mt-1 tabular-nums">{value}</div>
      {hint && <div className="text-xs text-gray-500 mt-1">{hint}</div>}
    </div>
  )
}

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-gray-300">
      <span className={`w-1.5 h-1.5 rounded-full ${ok ? 'bg-emerald-400' : 'bg-rose-400'}`} />
      {label}
    </span>
  )
}

function SystemSection({ data }: { data: AdminOverviewResponse }) {
  const sys = data.system
  const ai = sys.ai
  const enginePool = (sys.engine_pool ?? {}) as Record<string, unknown>
  const memory = (sys.memory ?? {}) as Record<string, unknown>
  const memoryCurrent = (memory.current ?? {}) as Record<string, unknown>
  const caches = sys.caches

  const inUse = asNumber(enginePool.in_use)
  const maxSize = asNumber(enginePool.max_size) ?? asNumber(enginePool.pool_size)
  const processMb =
    asNumber(memoryCurrent.process_mb) ??
    asNumber(memory.rss_mb) ??
    asNumber(memory.process_memory_mb)

  return (
    <div>
      <SectionHeader icon={Server} title="System Health" />
      <Card>
        <div className="flex flex-wrap gap-x-6 gap-y-2 mb-4">
          <StatusPill ok={Boolean(sys.stockfish_available)} label="Stockfish" />
          <StatusPill ok={Boolean(sys.database_connected)} label="Database" />
          <StatusPill
            ok={Boolean(ai?.enabled)}
            label={`AI ${ai?.enabled ? '· ' + (ai.model ?? 'on') : '(off)'}`}
          />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <StatTile
            label="Engine pool"
            value={inUse !== null ? formatNumber(inUse) : '–'}
            hint={maxSize !== null ? `of ${maxSize} engines` : undefined}
          />
          <StatTile
            label="Memory (MB)"
            value={processMb !== null ? formatNumber(processMb) : '–'}
            hint="process RSS"
          />
          <StatTile
            label="Cache hit rate"
            value={cacheHitRate(caches)}
          />
          <StatTile
            label="Cache entries"
            value={cacheTotalEntries(caches)}
          />
        </div>
      </Card>
    </div>
  )
}

function UsersSection({ data }: { data: AdminOverviewResponse }) {
  const u = data.users
  const tierEntries = Object.entries(u.by_tier ?? {})
  return (
    <div>
      <SectionHeader icon={Users} title="Users" />
      <Card>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
          <StatTile label="Total" value={formatNumber(u.total)} />
          <StatTile label="New (7d)" value={formatNumber(u.new_7d)} />
          <StatTile
            label="Active (7d)"
            value={formatNumber(data.activity.active_users_7d)}
            hint="distinct analysers"
          />
          <StatTile
            label="Active (30d)"
            value={formatNumber(data.activity.active_users_30d)}
          />
        </div>
        {tierEntries.length > 0 && (
          <div>
            <div className="text-[11px] text-gray-500 uppercase tracking-wider mb-2">
              By account tier
            </div>
            <div className="flex flex-wrap gap-2">
              {tierEntries
                .sort((a, b) => b[1] - a[1])
                .map(([tier, count]) => (
                  <span
                    key={tier}
                    className="px-2 py-1 rounded-md bg-[#151618] text-xs text-gray-300"
                  >
                    {tier} <span className="text-white font-medium ml-1">{count}</span>
                  </span>
                ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}

function ActivitySection({ data }: { data: AdminOverviewResponse }) {
  const a = data.activity
  return (
    <div>
      <SectionHeader icon={Activity} title="Activity" />
      <Card>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          <StatTile
            label="Games (24h)"
            value={formatNumber(a.games_24h)}
            hint={`${formatNumber(a.games_7d)} this week`}
          />
          <StatTile
            label="Analyses (24h)"
            value={formatNumber(a.analyses_24h)}
            hint={`${formatNumber(a.analyses_7d)} this week`}
          />
          <StatTile
            label="Total analyses"
            value={formatNumber(a.analyses_total)}
            hint={`${formatNumber(a.games_total)} games imported`}
          />
        </div>
      </Card>
    </div>
  )
}

function QueueSection({ data }: { data: AdminOverviewResponse }) {
  const q = data.queue ?? {}
  const tiles: Array<{ key: string; label: string }> = [
    { key: 'pending', label: 'Pending' },
    { key: 'running', label: 'Running' },
    { key: 'completed', label: 'Completed' },
    { key: 'failed', label: 'Failed' },
    { key: 'cancelled', label: 'Cancelled' },
    { key: 'active_workers', label: 'Workers' },
  ]
  const hasAny = tiles.some(t => q[t.key] !== undefined)
  return (
    <div>
      <SectionHeader icon={Cpu} title="Analysis Queue" />
      <Card>
        {hasAny ? (
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            {tiles.map(t => (
              <StatTile key={t.key} label={t.label} value={formatNumber(asNumber(q[t.key]))} />
            ))}
          </div>
        ) : (
          <div className="text-sm text-gray-500">Queue stats unavailable.</div>
        )}
      </Card>
    </div>
  )
}

function SubscriptionsSection({ data }: { data: AdminOverviewResponse }) {
  const s = data.subscriptions
  const statusEntries = Object.entries(s.by_status ?? {})
  const tierEntries = Object.entries(s.paying_by_tier ?? {})
  return (
    <div>
      <SectionHeader icon={Wallet} title="Subscriptions" />
      <Card>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4">
          <StatTile label="Paying users" value={formatNumber(s.paying_active)} />
          <StatTile
            label="Paid tiers"
            value={tierEntries.length}
            hint="non-free accounts"
          />
          <StatTile
            label="Statuses"
            value={statusEntries.length}
          />
        </div>
        {tierEntries.length > 0 && (
          <div className="mb-3">
            <div className="text-[11px] text-gray-500 uppercase tracking-wider mb-2">
              Active paying by tier
            </div>
            <div className="flex flex-wrap gap-2">
              {tierEntries
                .sort((a, b) => b[1] - a[1])
                .map(([tier, count]) => (
                  <span key={tier} className="px-2 py-1 rounded-md bg-[#151618] text-xs text-gray-300">
                    {tier} <span className="text-white font-medium ml-1">{count}</span>
                  </span>
                ))}
            </div>
          </div>
        )}
        {statusEntries.length > 0 && (
          <div>
            <div className="text-[11px] text-gray-500 uppercase tracking-wider mb-2">
              By status
            </div>
            <div className="flex flex-wrap gap-2">
              {statusEntries
                .sort((a, b) => b[1] - a[1])
                .map(([status, count]) => (
                  <span key={status} className="px-2 py-1 rounded-md bg-[#151618] text-xs text-gray-300">
                    {status} <span className="text-white font-medium ml-1">{count}</span>
                  </span>
                ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}

type SortKey = AdminUsersSort

const SORT_OPTIONS: Array<{ key: SortKey; label: string }> = [
  { key: 'last_active', label: 'Last active' },
  { key: 'games_analyzed', label: 'Most analyzed' },
  { key: 'games_imported', label: 'Most imported' },
  { key: 'joined', label: 'Newest' },
  { key: 'email', label: 'Email A–Z' },
]

function UsersTableSection({ enabled }: { enabled: boolean }) {
  const [rows, setRows] = useState<AdminUserRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [submitted, setSubmitted] = useState('')
  const [offset, setOffset] = useState(0)
  const [sort, setSort] = useState<SortKey>('last_active')
  const [order, setOrder] = useState<AdminSortOrder>('desc')
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const limit = 25

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    setLoading(true)
    setErr(null)
    AdminService.users({ limit, offset, search: submitted || undefined, sort, order })
      .then(resp => {
        if (cancelled) return
        setRows(resp.users)
        setTotal(resp.total)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setErr(e instanceof Error ? e.message : 'Failed to load users')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [enabled, offset, submitted, sort, order])

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setOffset(0)
    setSubmitted(search.trim())
  }

  const handleSortClick = (key: SortKey) => {
    if (sort === key) {
      setOrder(order === 'desc' ? 'asc' : 'desc')
    } else {
      setSort(key)
      setOrder(key === 'email' ? 'asc' : 'desc')
    }
    setOffset(0)
  }

  const showingFrom = total === 0 ? 0 : offset + 1
  const showingTo = Math.min(offset + rows.length, total)
  const canPrev = offset > 0
  const canNext = offset + rows.length < total

  return (
    <div>
      <SectionHeader icon={UserCog} title="User Directory" />
      <Card>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <form onSubmit={onSearch} className="flex items-center gap-2 flex-1">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-3.5 h-3.5 text-gray-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by email or username..."
                className="w-full pl-8 pr-3 py-1.5 rounded-md bg-[#151618] text-xs text-gray-200 placeholder:text-gray-500 outline-none"
                style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.04)' }}
              />
            </div>
            <button
              type="submit"
              className="px-3 py-1.5 rounded-md bg-[#1c1d20] text-gray-300 text-xs font-medium hover:bg-[#232428] transition-colors"
            >
              Search
            </button>
            {submitted && (
              <button
                type="button"
                onClick={() => {
                  setSearch('')
                  setSubmitted('')
                  setOffset(0)
                }}
                className="px-2 py-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
              >
                Clear
              </button>
            )}
          </form>

          <div className="flex items-center gap-1">
            <span className="text-[11px] text-gray-500 uppercase tracking-wider mr-1">Sort</span>
            <select
              value={sort}
              onChange={e => {
                setSort(e.target.value as SortKey)
                setOrder(e.target.value === 'email' ? 'asc' : 'desc')
                setOffset(0)
              }}
              className="px-2 py-1.5 rounded-md bg-[#151618] text-xs text-gray-200 outline-none"
              style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.04)' }}
            >
              {SORT_OPTIONS.map(opt => (
                <option key={opt.key} value={opt.key}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        {err ? (
          <div className="text-xs text-rose-300 font-mono py-3">{err}</div>
        ) : loading && rows.length === 0 ? (
          <div className="flex items-center text-xs text-gray-500 py-6">
            <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
            Loading users...
          </div>
        ) : rows.length === 0 ? (
          <div className="text-xs text-gray-500 py-3">No users found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-gray-500">
                  <SortableTh label="Email" sortKey="email" current={sort} order={order} onClick={handleSortClick} />
                  <th className="py-2 pr-3 font-medium">Tier</th>
                  <th className="py-2 pr-3 font-medium">Chess.com</th>
                  <th className="py-2 pr-3 font-medium">Lichess</th>
                  <SortableTh label="Imported" sortKey="games_imported" current={sort} order={order} onClick={handleSortClick} align="right" />
                  <SortableTh label="Analyzed" sortKey="games_analyzed" current={sort} order={order} onClick={handleSortClick} align="right" />
                  <SortableTh label="Joined" sortKey="joined" current={sort} order={order} onClick={handleSortClick} />
                  <SortableTh label="Last active" sortKey="last_active" current={sort} order={order} onClick={handleSortClick} last />
                </tr>
              </thead>
              <tbody>
                {rows.map(u => (
                  <tr key={u.id} className="border-t border-white/[0.04]">
                    <td className="py-2 pr-3">
                      <button
                        type="button"
                        onClick={() => setSelectedUserId(u.id)}
                        className="text-gray-200 hover:text-white underline-offset-2 hover:underline transition-colors text-left"
                      >
                        {u.email ?? <span className="text-gray-500">{u.id.slice(0, 8)}…</span>}
                      </button>
                    </td>
                    <td className="py-2 pr-3">
                      <TierBadge tier={u.account_tier} status={u.subscription_status} />
                    </td>
                    <td className="py-2 pr-3 text-gray-300">
                      {u.chess_com_username ?? <span className="text-gray-600">—</span>}
                      {u.primary_platform === 'chess.com' && u.chess_com_username && (
                        <span className="ml-1 text-[10px] text-gray-500">primary</span>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-gray-300">
                      {u.lichess_username ?? <span className="text-gray-600">—</span>}
                      {u.primary_platform === 'lichess' && u.lichess_username && (
                        <span className="ml-1 text-[10px] text-gray-500">primary</span>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-gray-300 tabular-nums text-right">
                      {formatNumber(u.games_imported)}
                    </td>
                    <td className="py-2 pr-3 text-gray-300 tabular-nums text-right">
                      {formatNumber(u.games_analyzed)}
                    </td>
                    <td className="py-2 pr-3 text-gray-400 tabular-nums">
                      {formatDate(u.created_at)}
                    </td>
                    <td className="py-2 pr-0 text-gray-400 tabular-nums">
                      {formatDate(u.last_active_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
          <span>
            {total > 0 ? `${showingFrom}–${showingTo} of ${total}` : '0 users'}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!canPrev || loading}
              onClick={() => setOffset(Math.max(0, offset - limit))}
              className="px-2.5 py-1 rounded-md bg-[#1c1d20] text-gray-300 hover:bg-[#232428] transition-colors disabled:opacity-40"
            >
              Prev
            </button>
            <button
              type="button"
              disabled={!canNext || loading}
              onClick={() => setOffset(offset + limit)}
              className="px-2.5 py-1 rounded-md bg-[#1c1d20] text-gray-300 hover:bg-[#232428] transition-colors disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </Card>

      {selectedUserId && (
        <UserDetailModal userId={selectedUserId} onClose={() => setSelectedUserId(null)} />
      )}
    </div>
  )
}

function SortableTh({
  label,
  sortKey,
  current,
  order,
  onClick,
  align,
  last,
}: {
  label: string
  sortKey: SortKey
  current: SortKey
  order: AdminSortOrder
  onClick: (k: SortKey) => void
  align?: 'right'
  last?: boolean
}) {
  const isActive = current === sortKey
  return (
    <th className={`py-2 ${last ? 'pr-0' : 'pr-3'} font-medium ${align === 'right' ? 'text-right' : ''}`}>
      <button
        type="button"
        onClick={() => onClick(sortKey)}
        className={`inline-flex items-center gap-1 uppercase tracking-wider hover:text-gray-300 transition-colors ${
          isActive ? 'text-gray-300' : ''
        }`}
      >
        {label}
        {isActive && (
          <span className="text-[9px]">{order === 'desc' ? '▼' : '▲'}</span>
        )}
      </button>
    </th>
  )
}

function UserDetailModal({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [data, setData] = useState<AdminUserDetailResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setErr(null)
    AdminService.userDetail(userId)
      .then(d => { if (!cancelled) setData(d) })
      .catch(e => { if (!cancelled) setErr(e instanceof Error ? e.message : 'Failed to load') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [userId])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/60"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-xl rounded-lg bg-[#0c0d0f] p-5"
        style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.06), 0 12px 32px rgba(0,0,0,0.5)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="text-[11px] text-gray-500 uppercase tracking-wider">User detail</div>
            <h3 className="text-base font-semibold text-white tabular-nums mt-0.5 break-all">
              {data?.email ?? (loading ? '—' : userId)}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-gray-500 hover:text-gray-200 hover:bg-white/[0.04] transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center text-xs text-gray-500 py-6">
            <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
            Loading...
          </div>
        ) : err ? (
          <div className="text-xs text-rose-300 font-mono py-3">{err}</div>
        ) : data ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              <StatTile label="Games imported" value={formatNumber(data.totals.games_imported)} />
              <StatTile label="Games analyzed" value={formatNumber(data.totals.games_analyzed)} />
              <StatTile
                label="Last active"
                value={formatDate(data.last_active_at)}
              />
            </div>

            <div>
              <div className="text-[11px] text-gray-500 uppercase tracking-wider mb-2">
                Connected accounts
              </div>
              {data.per_platform.length === 0 ? (
                <div className="text-xs text-gray-500">No linked chess accounts.</div>
              ) : (
                <div className="space-y-2">
                  {data.per_platform.map(pp => (
                    <div
                      key={pp.platform}
                      className="rounded-md p-3 bg-[#151618] flex items-center justify-between"
                    >
                      <div>
                        <div className="text-sm text-gray-200">
                          {pp.username}
                          {pp.is_primary && (
                            <span className="ml-2 text-[10px] text-gray-500">primary</span>
                          )}
                        </div>
                        <div className="text-[11px] text-gray-500 mt-0.5">
                          {pp.platform} · last active {formatDate(pp.last_active_at)}
                        </div>
                      </div>
                      <div className="text-right text-xs tabular-nums">
                        <div className="text-gray-300">
                          {formatNumber(pp.games_analyzed)} <span className="text-gray-500">analyzed</span>
                        </div>
                        <div className="text-gray-400">
                          {formatNumber(pp.games_imported)} <span className="text-gray-500">imported</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="text-[11px] text-gray-500 uppercase tracking-wider mb-2">
                Account
              </div>
              <dl className="text-xs space-y-1.5">
                <DetailRow label="Tier">
                  <TierBadge tier={data.account_tier} status={data.subscription_status} />
                </DetailRow>
                <DetailRow label="Subscription status">
                  <span className="text-gray-300">{data.subscription_status ?? '—'}</span>
                </DetailRow>
                {data.subscription_end_date && (
                  <DetailRow label="Subscription ends">
                    <span className="text-gray-300 tabular-nums">{formatDate(data.subscription_end_date)}</span>
                  </DetailRow>
                )}
                <DetailRow label="Joined">
                  <span className="text-gray-300 tabular-nums">{formatDate(data.created_at)}</span>
                </DetailRow>
                <DetailRow label="User ID">
                  <span className="text-gray-500 font-mono text-[10px] break-all">{data.id}</span>
                </DetailRow>
              </dl>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  )
}

function TierBadge({ tier, status }: { tier: string | null; status: string | null }) {
  if (!tier) return <span className="text-gray-600">—</span>
  const isFree = tier === 'free'
  const isInactive = status && status !== 'active' && status !== 'trialing'
  const tone = isFree
    ? 'text-gray-400'
    : isInactive
      ? 'text-amber-300/80'
      : 'text-emerald-300/90'
  return (
    <span className={`inline-flex items-center gap-1 ${tone}`}>
      {tier}
      {isInactive && <span className="text-[10px] text-amber-400/70">({status})</span>}
    </span>
  )
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
  } catch {
    return iso
  }
}

function DataErrorsCard({ errors }: { errors: string[] }) {
  return (
    <div className="rounded-lg p-4" style={{ boxShadow: '0 0 0 1px rgba(244,63,94,0.2)' }}>
      <div className="flex items-center gap-2 mb-2">
        <AlertCircle className="w-4 h-4 text-rose-400" />
        <h2 className="text-[11px] font-medium text-rose-300 tracking-widest uppercase">
          Partial data
        </h2>
      </div>
      <ul className="text-xs text-gray-400 space-y-1">
        {errors.map((e, i) => (
          <li key={i} className="font-mono">{e}</li>
        ))}
      </ul>
    </div>
  )
}

function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-lg p-6" style={{ boxShadow: '0 0 0 1px rgba(244,63,94,0.2)' }}>
      <div className="flex items-center gap-2 mb-2">
        <AlertCircle className="w-4 h-4 text-rose-400" />
        <h2 className="text-sm font-medium text-rose-300">Could not load admin overview</h2>
      </div>
      <p className="text-xs text-gray-400 mb-4 font-mono">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="px-3 py-1.5 rounded-md bg-[#1c1d20] text-gray-300 text-xs font-medium hover:bg-[#232428] transition-colors"
      >
        Retry
      </button>
    </div>
  )
}

function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '–'
  return new Intl.NumberFormat('en-US').format(Math.round(value))
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) {
    return Number(value)
  }
  return null
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString()
  } catch {
    return iso
  }
}

function iterateCaches(caches: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(caches)) return caches as Array<Record<string, unknown>>
  if (caches && typeof caches === 'object') {
    return Object.values(caches as Record<string, unknown>).filter(
      (v): v is Record<string, unknown> => Boolean(v) && typeof v === 'object'
    )
  }
  return []
}

function cacheHitRate(caches: unknown): string {
  let hits = 0
  let misses = 0
  for (const v of iterateCaches(caches)) {
    hits += asNumber(v.hits) ?? 0
    misses += asNumber(v.misses) ?? 0
  }
  const total = hits + misses
  if (total === 0) return '–'
  return `${Math.round((hits / total) * 100)}%`
}

function cacheTotalEntries(caches: unknown): string {
  let total = 0
  let any = false
  for (const v of iterateCaches(caches)) {
    const size = asNumber(v.size) ?? asNumber(v.entries) ?? asNumber(v.length)
    if (size !== null) {
      total += size
      any = true
    }
  }
  return any ? formatNumber(total) : '–'
}
