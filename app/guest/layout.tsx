'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/context'
import { GuestBottomNav } from '@/components/layout/GuestBottomNav'

export default function GuestLayout({
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
            } else if (user.role !== 'guest') {
                // Non-guest users should use appropriate portal
                if (user.role === 'admin') {
                    router.push('/admin')
                } else if (user.role === 'kitchen_manager' || user.role === 'staff') {
                    router.push('/kitchen')
                } else {
                    // student role
                    router.push('/home')
                }
            }
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

    // Only render for guest users
    if (!user || user.role !== 'guest') {
        return null
    }

    return (
        <div style={{ paddingBottom: '80px' }}>
            {children}
            <GuestBottomNav />
        </div>
    )
}
