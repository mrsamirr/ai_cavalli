'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/context'
import { BottomNav } from '@/components/layout/BottomNav'

export default function CustomerLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const { user, isLoading } = useAuth()
    const router = useRouter()

    useEffect(() => {
        if (!isLoading) {
            if (!user) {
                // No authenticated user - redirect to login
                router.push('/login')
            } else if (user.role === 'guest') {
                // Guests should use guest portal
                router.push('/guest/home')
            } else if (user.role === 'kitchen_manager' || user.role === 'admin') {
                // Kitchen/admin users should use kitchen portal
                router.push('/kitchen')
            }
            // Only students and staff can access customer portal
        }
    }, [user, isLoading, router])

    if (isLoading) {
        return <div className="loading-screen" style={{
            height: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--background)',
            color: 'var(--text-muted)'
        }}>Loading...</div>
    }

    // Only render for student and staff roles
    if (!user || user.role === 'guest' || user.role === 'kitchen_manager' || user.role === 'admin') {
        return null
    }

    return (
        <div style={{ paddingBottom: '80px' }}>
            {children}
            <BottomNav />
        </div>
    )
}
