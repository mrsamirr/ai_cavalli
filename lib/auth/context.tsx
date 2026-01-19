'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/database/supabase'
import type { User, Session } from '@supabase/supabase-js'

type UserRole = 'student' | 'staff' | 'kitchen_manager' | 'admin' | 'guest'

interface AuthContextType {
    user: User | null
    session: Session | null
    role: UserRole | null
    isLoading: boolean
    signIn: (phone: string, pin: string) => Promise<{ error: any }>
    signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [session, setSession] = useState<Session | null>(null)
    const [role, setRole] = useState<UserRole | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const router = useRouter()

    useEffect(() => {
        // Check active session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session)
            setUser(session?.user ?? null)
            if (session?.user) {
                fetchUserRole(session.user.id)
            } else {
                setIsLoading(false)
            }
        })

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session)
            setUser(session?.user ?? null)
            if (session?.user) {
                fetchUserRole(session.user.id)
            } else {
                setRole(null)
                setIsLoading(false)
            }
        })

        return () => subscription.unsubscribe()
    }, [])

    const fetchUserRole = async (userId: string) => {
        try {
            const { data, error } = await supabase
                .from('users')
                .select('role')
                .eq('id', userId)
                .single()

            if (data) {
                setRole(data.role as UserRole)
            }
        } catch (error) {
            console.error('Error fetching role:', error)
        } finally {
            setIsLoading(false)
        }
    }

    const signIn = async (phone: string, pin: string) => {
        // Sanitize phone input
        const numeric = phone.replace(/\D/g, '')
        const sanitizedPhone = numeric.startsWith('0') ? numeric.slice(1) : numeric
        const cleanPhone = sanitizedPhone.slice(0, 10)

        // Map phone to dummy email
        const email = `${cleanPhone}@example.com`
        const { error } = await supabase.auth.signInWithPassword({
            email,
            password: pin,
        })

        if (error) {
            console.error('[Auth] Sign-in failed:', {
                message: error.message,
                status: error.status,
                email
            })
            if (error.message.includes('Email not confirmed')) {
                console.warn('💡 TIP: Email confirmation is enabled in Supabase. Disable it in the dashboard (Authentication -> Settings) or use a real email to confirm.')
            }
        }

        return { error }
    }

    const signOut = async () => {
        await supabase.auth.signOut()
        router.push('/login')
    }

    return (
        <AuthContext.Provider value={{ user, session, role, isLoading, signIn, signOut }}>
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
