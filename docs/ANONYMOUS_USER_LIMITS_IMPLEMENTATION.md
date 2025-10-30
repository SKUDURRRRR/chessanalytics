# Anonymous User Limits - Implementation Plan

## Requirements

### Anonymous User Limitations
1. **Import Limit:** 100 games per 24 hours (resets after 24 hours)
2. **Analysis Limit:** 5 analyses per 24 hours (resets after 24 hours)
3. **No Auto-Sync:** Automatic game synchronization disabled
4. **Registration Popup:** When limits reached, show invite to register

### Popup Message Content
- Free tier allows:
  - 100 imports per 24 hours
  - 5 analyses per 24 hours
- No credit card required

## Implementation Strategy

Since we cannot track individual anonymous users reliably (no auth, IP can be shared/VPN'd), we'll use **session-based tracking** with the understanding that users can bypass by clearing browser data. This is acceptable as:
1. It provides friction to prevent casual abuse
2. Power users who want more will register
3. It's better UX than requiring immediate registration

### Tracking Method
- Use browser `localStorage` to track usage
- Key: `chess_analytics_anonymous_usage`
- Value: `{ imports: number, analyses: number, lastReset: timestamp }`
- Note: Can be bypassed by clearing localStorage (acceptable)

## Implementation Steps

### 1. Backend Changes (Minimal)
- Keep optional auth on all endpoints
- Remove anonymous limit enforcement from backend
- Let frontend handle the gate-keeping

**Why?** Backend cannot reliably track anonymous users. Frontend localStorage is more reliable for this use case.

### 2. Frontend: Anonymous Usage Tracker Service

Create `src/services/anonymousUsageTracker.ts`:

```typescript
interface AnonymousUsage {
  imports: number
  analyses: number
  resetAt: string // ISO timestamp when limits reset
}

const STORAGE_KEY = 'chess_analytics_anonymous_usage'

export class AnonymousUsageTracker {
  private static getUsage(): AnonymousUsage {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) {
      const resetAt = new Date()
      resetAt.setHours(resetAt.getHours() + 24)
      return { imports: 0, analyses: 0, resetAt: resetAt.toISOString() }
    }
    const usage = JSON.parse(stored)

    // Check if 24 hours have passed
    const resetTime = new Date(usage.resetAt)
    if (new Date() >= resetTime) {
      // Reset limits
      const newResetAt = new Date()
      newResetAt.setHours(newResetAt.getHours() + 24)
      return { imports: 0, analyses: 0, resetAt: newResetAt.toISOString() }
    }

    return usage
  }

  private static saveUsage(usage: AnonymousUsage): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(usage))
  }

  static canImport(): boolean {
    const usage = this.getUsage()
    return usage.imports < 100
  }

  static canAnalyze(): boolean {
    const usage = this.getUsage()
    return usage.analyses < 5
  }

  static incrementImports(count: number): void {
    const usage = this.getUsage()
    usage.imports += count
    this.saveUsage(usage)
  }

  static incrementAnalyses(): void {
    const usage = this.getUsage()
    usage.analyses += 1
    this.saveUsage(usage)
  }

  static getStats(): {
    imports: { used: number; remaining: number }
    analyses: { used: number; remaining: number }
  } {
    const usage = this.getUsage()
    return {
      imports: {
        used: usage.imports,
        remaining: Math.max(0, 100 - usage.imports)
      },
      analyses: {
        used: usage.analyses,
        remaining: Math.max(0, 5 - usage.analyses)
      }
    }
  }

  static reset(): void {
    localStorage.removeItem(STORAGE_KEY)
  }
}
```

### 3. Frontend: Registration Invitation Modal

Create `src/components/AnonymousLimitModal.tsx`:

```typescript
interface AnonymousLimitModalProps {
  isOpen: boolean
  onClose: () => void
  limitType: 'import' | 'analyze'
}

export default function AnonymousLimitModal({
  isOpen,
  onClose,
  limitType
}: AnonymousLimitModalProps) {
  if (!isOpen) return null

  const title = limitType === 'import'
    ? 'Import Limit Reached'
    : 'Analysis Limit Reached'

  const message = limitType === 'import'
    ? 'You\'ve reached your guest limit of 100 imports per 24 hours.'
    : 'You\'ve reached your guest limit of 5 analyses per 24 hours.'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="max-w-md rounded-lg bg-slate-800 p-6 shadow-xl">
        <h2 className="mb-4 text-2xl font-bold text-white">{title}</h2>

        <p className="mb-4 text-slate-300">{message}</p>

        <div className="mb-6 rounded-lg bg-sky-500/10 border border-sky-400/30 p-4">
          <h3 className="mb-2 font-semibold text-sky-200">
            Create a free account to get:
          </h3>
          <ul className="space-y-1 text-sm text-slate-300">
            <li>✓ 100 imports per 24 hours</li>
            <li>✓ 5 analyses per 24 hours</li>
            <li>✓ Auto-sync your latest games</li>
            <li>✓ Save your analysis history</li>
            <li className="text-emerald-300 font-medium">✓ No credit card required</li>
          </ul>
        </div>

        <div className="flex gap-3">
          <Link
            to="/signup"
            className="flex-1 rounded-lg bg-sky-500 px-4 py-2 text-center font-medium text-white hover:bg-sky-600 transition"
          >
            Sign Up Free
          </Link>
          <Link
            to="/login"
            className="flex-1 rounded-lg border border-slate-600 px-4 py-2 text-center font-medium text-slate-300 hover:bg-slate-700 transition"
          >
            Log In
          </Link>
        </div>

        <button
          onClick={onClose}
          className="mt-3 w-full text-sm text-slate-400 hover:text-slate-300"
        >
          Maybe later
        </button>
      </div>
    </div>
  )
}
```

### 4. Frontend: Update Import Flow

In `src/components/simple/PlayerSearch.tsx`:

```typescript
import { AnonymousUsageTracker } from '../../services/anonymousUsageTracker'
import AnonymousLimitModal from '../AnonymousLimitModal'

// Add state
const [anonymousLimitModalOpen, setAnonymousLimitModalOpen] = useState(false)
const [limitType, setLimitType] = useState<'import' | 'analyze'>('import')

// Before import
const handleImport = async () => {
  // Check if user is anonymous
  if (!user) {
    if (!AnonymousUsageTracker.canImport()) {
      setLimitType('import')
      setAnonymousLimitModalOpen(true)
      return
    }
  }

  // Proceed with import...
  const result = await importGames(...)

  // After successful import (anonymous only)
  if (!user && result.success) {
    AnonymousUsageTracker.incrementImports(result.games_imported || 0)
  }
}
```

### 5. Frontend: Update Analysis Flow

In `src/pages/SimpleAnalyticsPage.tsx`:

```typescript
import { AnonymousUsageTracker } from '../services/anonymousUsageTracker'
import AnonymousLimitModal from '../components/AnonymousLimitModal'

// Add state
const [anonymousLimitModalOpen, setAnonymousLimitModalOpen] = useState(false)
const [limitType, setLimitType] = useState<'import' | 'analyze'>('import')

// Before analysis
const startAnalysis = async () => {
  // Check if user is anonymous
  if (!user) {
    if (!AnonymousUsageTracker.canAnalyze()) {
      setLimitType('analyze')
      setAnonymousLimitModalOpen(true)
      return
    }
  }

  // Proceed with analysis...
  const result = await analyzeGames(...)

  // After successful analysis (anonymous only)
  if (!user && result.success) {
    AnonymousUsageTracker.incrementAnalyses()
  }
}
```

### 6. Frontend: Disable Auto-Sync for Anonymous Users

In `src/pages/SimpleAnalyticsPage.tsx`:

```typescript
// Don't show auto-sync toggle for anonymous users
{user && (
  <label>
    <input
      type="checkbox"
      checked={autoSync}
      onChange={(e) => setAutoSync(e.target.checked)}
    />
    Auto-sync latest games
  </label>
)}

// Add explanation for anonymous users
{!user && (
  <div className="text-sm text-slate-400">
    Sign in to enable auto-sync
  </div>
)}
```

### 7. Database Migration (Keep Read-Only for Anonymous)

Use the existing migration `20250131000001_allow_anon_read_access.sql` which:
- ✅ Grants SELECT to anonymous users
- ❌ Blocks INSERT/UPDATE/DELETE for anonymous users
- ✅ Backend writes with service_role (bypasses RLS)

## Trade-offs

### Why localStorage Instead of Backend Tracking?

**Backend tracking problems:**
1. Cannot reliably identify anonymous users
2. IP address shared (corporate, VPN, mobile)
3. Rate limiting != usage limiting
4. Complex server-side session management

**localStorage advantages:**
1. Works offline/client-side
2. Persists across page refreshes
3. Simple implementation
4. Clear to users (can see in DevTools)

**localStorage limitations:**
1. Can be cleared (acceptable - provides friction)
2. Per-browser (acceptable - encourages registration)
3. Can be bypassed (acceptable - not high-value target)

### Security Considerations

**Q: Can users bypass the limits?**
A: Yes, by clearing localStorage or using incognito mode.

**Q: Is this acceptable?**
A: Yes, because:
- Analysis is computationally expensive (backend rate limiting protects us)
- Data is public anyway (no private data risk)
- Users who want more will register (conversion funnel)
- Sophisticated users bypassing limits are rare
- Backend still has rate limiting (5 requests/minute)

**Q: Should we track by IP?**
A: No, because:
- IP can be shared (false positives)
- IP can be rotated (false negatives)
- Privacy concerns (GDPR)
- Complex server-side state management

## Testing Checklist

### Anonymous User Flow
- [ ] Visit site without logging in
- [ ] Import games (should work for first 100)
- [ ] Try to import more than 100 (should show modal)
- [ ] Modal should mention free tier benefits
- [ ] Modal should have "Sign Up" and "Log In" buttons
- [ ] Click "Analyze games" (should work once)
- [ ] Try to analyze again (should show modal)
- [ ] Auto-sync toggle should not appear
- [ ] Clear localStorage and verify limits reset

### Authenticated User Flow
- [ ] Log in as free tier user
- [ ] Import games (should use server-side tracking)
- [ ] Analyze games (should use server-side tracking)
- [ ] Auto-sync toggle should appear
- [ ] Limits should persist across sessions
- [ ] Limits should reset after 24 hours

## Summary

This implementation provides:
1. ✅ Friction to prevent casual abuse
2. ✅ Clear path to registration
3. ✅ Simple implementation
4. ✅ Good UX
5. ✅ Acceptable security trade-offs
6. ✅ Conversion funnel to registration

The goal is not perfect security, but rather to:
- Prevent casual overuse
- Encourage registration
- Provide value to visitors
- Convert visitors to users
