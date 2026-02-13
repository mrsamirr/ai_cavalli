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
                router.push('/login')
            } else if (user.role === 'OUTSIDER') {
                router.push('/guest/home')
            } else if (user.role === 'KITCHEN' || user.role === 'ADMIN') {
                router.push('/kitchen')
            }
            // Only STUDENT can access customer portal
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

    // Only render for STUDENT role
    if (!user || user.role === 'OUTSIDER' || user.role === 'KITCHEN' || user.role === 'ADMIN') {
        return null
    }

    return (
        <div style={{ paddingBottom: '80px' }}>
            {children}
            <BottomNav />
        </div>
    )
}
