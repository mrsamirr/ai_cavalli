'use client'

import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { AuthChangeEvent, Session } from '@supabase/supabase-js'

type UserRole = 'student' | 'staff' | 'kitchen_manager' | 'admin' | 'guest'

interface AuthUser {
    id: string
    email: string
    name: string
    role: UserRole
    phone?: string
}

interface AuthContextType {
    user: AuthUser | null
    isLoading: boolean
    signIn: (userData: AuthUser) => void
    signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Helper to set auth cookie for middleware detection
function setAuthCookie(role: UserRole | null) {
    if (typeof document === 'undefined') return

    if (role === null) {
        // Clear cookies on logout
        document.cookie = 'auth_role=; path=/; max-age=0; SameSite=Lax'
        document.cookie = 'guest_session_active=; path=/; max-age=0; SameSite=Lax'
    } else if (role === 'guest') {
        // Set guest session cookie
        document.cookie = 'guest_session_active=true; path=/; max-age=86400; SameSite=Lax'
        document.cookie = 'auth_role=guest; path=/; max-age=86400; SameSite=Lax'
    } else {
        // Set staff/admin auth cookie
        document.cookie = `auth_role=${role}; path=/; max-age=86400; SameSite=Lax`
        document.cookie = 'guest_session_active=; path=/; max-age=0; SameSite=Lax'
    }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const router = useRouter()

    // Create Supabase client (SSR-compatible browser client)
    const supabase = useMemo(() => createClient(), [])

    // Initialize user from localStorage (client-side only)
    useEffect(() => {
        const initializeAuth = async () => {
            // First, check localStorage for cached user
            const storedUser = localStorage.getItem('user')
            let cachedUser: AuthUser | null = null

            if (storedUser) {
                try {
                    cachedUser = JSON.parse(storedUser)
                } catch (e) {
                    console.error('Failed to parse stored user:', e)
                    localStorage.removeItem('user')
                }
            }

            // For non-guest users, validate Supabase session when possible
            if (cachedUser && cachedUser.role !== 'guest') {
                try {
                    // getUser() validates the JWT with the Supabase server
                    const { data: { user: authUser }, error } = await supabase.auth.getUser()

                    if (authUser && !error) {
                        // Session is valid, fetch fresh profile
                        const { data: profile } = await supabase
                            .from('users')
                            .select('id, email, name, role, phone')
                            .eq('id', authUser.id)
                            .single()

                        if (profile) {
                            setUser(profile)
                            localStorage.setItem('user', JSON.stringify(profile))
                            setAuthCookie(profile.role)
                        } else {
                            // Profile not found, clear session
                            await supabase.auth.signOut()
                            localStorage.removeItem('user')
                            setAuthCookie(null)
                        }
                    } else {
                        // Fall back to cached user when server session is not accessible in the browser
                        setUser(cachedUser)
                        setAuthCookie(cachedUser.role)
                    }
                } catch (error) {
                    console.error('Session validation error:', error)
                    setUser(cachedUser)
                    setAuthCookie(cachedUser.role)
                }
            } else if (cachedUser && cachedUser.role === 'guest') {
                // For guests, trust localStorage but verify guest session exists
                const guestSession = localStorage.getItem('guest_session')
                if (guestSession) {
                    setUser(cachedUser)
                    setAuthCookie('guest')
                } else {
                    // No guest session, clear user
                    localStorage.removeItem('user')
                    setAuthCookie(null)
                }
            }

            setIsLoading(false)
        }

        initializeAuth()

        // Listen for Supabase auth state changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event: AuthChangeEvent, session: Session | null) => {
                if (event === 'SIGNED_IN' && session?.user) {
                    // Fetch profile on sign in
                    const { data: profile } = await supabase
                        .from('users')
                        .select('id, email, name, role, phone')
                        .eq('id', session.user.id)
                        .single()

                    if (profile) {
                        setUser(profile)
                        localStorage.setItem('user', JSON.stringify(profile))
                        setAuthCookie(profile.role)
                    }
                } else if (event === 'SIGNED_OUT') {
                    setUser(null)
                    localStorage.removeItem('user')
                    setAuthCookie(null)
                } else if (event === 'TOKEN_REFRESHED' && session?.user) {
                    // Session was refreshed, ensure user state is current
                    const currentUser = localStorage.getItem('user')
                    if (currentUser) {
                        const parsed = JSON.parse(currentUser)
                        if (parsed.role !== 'guest') {
                            setAuthCookie(parsed.role)
                        }
                    }
                }
            }
        )

        return () => subscription.unsubscribe()
    }, [supabase])

    const signIn = useCallback((userData: AuthUser) => {
        localStorage.setItem('user', JSON.stringify(userData))
        setUser(userData)
        setAuthCookie(userData.role)
    }, [])

    const signOut = useCallback(async () => {
        // Sign out from Supabase (for non-guest users)
        try {
            await supabase.auth.signOut()
        } catch (e) {
            // Ignore errors if not signed into Supabase
        }

        // Clear all auth-related localStorage
        localStorage.removeItem('user')
        localStorage.removeItem('guest_session')
        localStorage.removeItem('guest_name')
        localStorage.removeItem('guest_email')
        localStorage.removeItem('guest_table')
        localStorage.removeItem('guest_num_guests')
        localStorage.removeItem('guest_phone')
        localStorage.removeItem('guest_orders')
        localStorage.removeItem('is_guest_active')
        localStorage.removeItem('cart')

        // Clear auth cookies
        setAuthCookie(null)

        setUser(null)
        router.push('/login')
    }, [router, supabase])

    return (
        <AuthContext.Provider value={{ user, isLoading, signIn, signOut }}>
            {children}
        </AuthContext.Provider>
    )
}

export const useAuth = () => {
    const context = useContext(AuthContext)
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
}
