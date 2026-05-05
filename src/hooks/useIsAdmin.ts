import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { AdminService } from '../services/adminService'

interface UseIsAdminResult {
  isAdmin: boolean
  loading: boolean
}

export function useIsAdmin(): UseIsAdminResult {
  const { user, loading: authLoading } = useAuth()
  const [isAdmin, setIsAdmin] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    let cancelled = false
    if (authLoading) return
    if (!user) {
      setIsAdmin(false)
      setChecking(false)
      return
    }
    setChecking(true)
    AdminService.check()
      .then(result => {
        if (!cancelled) setIsAdmin(result)
      })
      .finally(() => {
        if (!cancelled) setChecking(false)
      })
    return () => {
      cancelled = true
    }
  }, [user, authLoading])

  return { isAdmin, loading: authLoading || checking }
}
