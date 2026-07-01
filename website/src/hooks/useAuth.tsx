'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { User } from '@supabase/supabase-js'
import { getSupabaseBrowserClient } from '@/lib/supabase-client'

interface UserProfile {
  id: string
  email: string
  role: 'client' | 'driver' | 'admin' | 'broker'
  first_name?: string
  last_name?: string
  phone?: string
  avatar_url?: string
  created_at?: string
  address?: string
  city?: string
  state?: string
  zip_code?: string
}

interface UseAuthReturn {
  user: User | null
  profile: UserProfile | null
  loading: boolean
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  
  // Use singleton supabase client
  const supabase = getSupabaseBrowserClient()

  const fetchProfile = async (userId: string) => {
    try {
      // Timeout reduced to 3 s — the UI already rendered with optimistic metadata
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Profile fetch timeout after 3 seconds')), 3000)
      )
      
      // OPTIMIZED: Only select needed fields (70% less data transfer)
      const fetchPromise = supabase
        .from('profiles')
        .select('id, email, role, first_name, last_name, phone, avatar_url, created_at')
        .eq('id', userId)
        .single()
      
      const { data, error } = await Promise.race([fetchPromise, timeoutPromise]) as any

      if (error) {
        console.error('[useAuth] Error fetching profile:', error)
        return null
      }

      return data as UserProfile
    } catch (error) {
      console.error('[useAuth] Error fetching profile:', error)
      return null
    }
  }

  const refreshProfile = async () => {
    if (user) {
      const profileData = await fetchProfile(user.id)
      setProfile(profileData)
    }
  }

  useEffect(() => {
    let mounted = true
    
    const initializeAuth = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (session?.user && mounted) {
          setUser(session.user)

          // ── Optimistic profile from user_metadata (renders instantly) ──
          const meta = session.user.user_metadata || {}
          const optimisticProfile: UserProfile = {
            id: session.user.id,
            email: session.user.email || '',
            role: (meta.role as UserProfile['role']) || 'client',
            first_name: meta.first_name,
            last_name: meta.last_name,
            phone: meta.phone,
            avatar_url: meta.avatar_url,
          }
          setProfile(optimisticProfile)
          setLoading(false) // ← unblock UI immediately

          // ── Background: load authoritative profile from DB ──
          const profileData = await fetchProfile(session.user.id)
          if (mounted && profileData) {
            setProfile(profileData)
          }
        }
      } catch (error) {
        console.error('[useAuth] Error initializing auth:', error)
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    initializeAuth()

    // Listen to auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Only handle sign out - everything else is handled in initializeAuth
      if (event === 'SIGNED_OUT' && mounted) {
        setUser(null)
        setProfile(null)
        setLoading(false)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, []) // Empty deps - only run once on mount

  const signOut = async () => {
    try {
      await supabase.auth.signOut()
      setUser(null)
      setProfile(null)
      router.push('/login')
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  return {
    user,
    profile,
    loading,
    signOut,
    refreshProfile,
  }
}
