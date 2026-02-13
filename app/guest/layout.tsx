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
                router.push('/login')
            } else if (user.role !== 'OUTSIDER') {
                if (user.role === 'ADMIN' || user.role === 'KITCHEN') {
                    router.push('/kitchen')
                } else {
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

    // Only render for OUTSIDER (guest) users
    if (!user || user.role !== 'OUTSIDER') {
        return null
    }

    return (
        <div style={{ paddingBottom: '80px' }}>
            {children}
            <GuestBottomNav />
        </div>
    )
}
