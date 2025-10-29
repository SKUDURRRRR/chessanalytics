import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'

export default function ProfilePage() {
  const { user, usageStats, refreshUsageStats, updateProfile, signOut } = useAuth()
  const navigate = useNavigate()
  const [isEditing, setIsEditing] = useState(false)
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!user) {
      navigate('/login')
      return
    }
    setUsername(user.username || '')
    refreshUsageStats()
  }, [user, navigate, refreshUsageStats])

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      const { error } = await updateProfile({ username })
      if (error) {
        setError(error.message)
      } else {
        setSuccess('Profile updated successfully')
        setIsEditing(false)
      }
    } catch (err) {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-slate-400">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-extrabold text-white">Profile</h1>
          <p className="mt-2 text-sm text-slate-400">
            Manage your account settings and view your usage stats
          </p>
        </div>

        {error && (
          <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-900/50 border border-green-500 text-green-200 px-4 py-3 rounded">
            {success}
          </div>
        )}

        {/* Account Information */}
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-6">
          <h2 className="text-xl font-bold text-white mb-4">Account Information</h2>

          {isEditing ? (
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-700 rounded-md bg-slate-800 text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  minLength={3}
                  maxLength={30}
                  required
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(false)
                    setUsername(user.username || '')
                  }}
                  className="px-4 py-2 bg-slate-700 text-white rounded-md hover:bg-slate-600"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-400">Username</label>
                <p className="text-white">{user.username || 'Not set'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400">Email</label>
                <p className="text-white">{user.email}</p>
              </div>
              <button
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 bg-slate-700 text-white rounded-md hover:bg-slate-600 text-sm"
              >
                Edit Profile
              </button>
            </div>
          )}
        </div>

        {/* Usage Stats */}
        {usageStats && (
          <div className="bg-slate-900 border border-slate-700 rounded-lg p-6">
            <h2 className="text-xl font-bold text-white mb-4">Usage Statistics</h2>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-slate-300">Account Tier</span>
                  <span className="text-white font-semibold">{usageStats.tierName || 'Free'}</span>
                </div>
              </div>

              {!usageStats.isUnlimited && (
                <>
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-slate-300">Game Imports</span>
                      <span className="text-white">
                        {usageStats.imports?.used || 0} / {usageStats.imports?.limit || 0}
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full"
                        style={{
                          width: `${((usageStats.imports?.used || 0) / (usageStats.imports?.limit || 1)) * 100}%`
                        }}
                      />
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      {usageStats.imports?.remaining || 0} remaining
                    </p>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-slate-300">Game Analyses</span>
                      <span className="text-white">
                        {usageStats.analyses?.used || 0} / {usageStats.analyses?.limit || 0}
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2">
                      <div
                        className="bg-green-500 h-2 rounded-full"
                        style={{
                          width: `${((usageStats.analyses?.used || 0) / (usageStats.analyses?.limit || 1)) * 100}%`
                        }}
                      />
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      {usageStats.analyses?.remaining || 0} remaining
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-700">
                    <p className="text-sm text-slate-400">
                      Limits reset in {usageStats.resetsInHours?.toFixed(1)} hours
                    </p>
                  </div>
                </>
              )}

              {usageStats.isUnlimited && (
                <div className="text-center py-4">
                  <p className="text-green-400 font-semibold">✓ Unlimited Access</p>
                  <p className="text-sm text-slate-400 mt-1">You have unlimited imports and analyses</p>
                </div>
              )}
            </div>

            {!usageStats.isUnlimited && (
              <div className="mt-6">
                <a
                  href="/pricing"
                  className="block w-full text-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Upgrade to Pro for Unlimited Access
                </a>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-6">
          <h2 className="text-xl font-bold text-white mb-4">Actions</h2>
          <div className="space-y-3">
            <button
              onClick={handleSignOut}
              className="w-full px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
