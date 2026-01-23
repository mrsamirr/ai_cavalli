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
    const { user, role, isLoading } = useAuth()
    const router = useRouter()

    useEffect(() => {
        if (!isLoading) {
            if (!user) {
                // No authenticated user - redirect to login
                router.push('/login')
            } else if (role === 'kitchen_manager' || role === 'admin') {
                // Kitchen/admin users should use kitchen portal
                router.push('/kitchen')
            }
            // Else: authenticated student/staff can access customer portal
        }
    }, [user, role, isLoading, router])

    if (isLoading) {
        return <div className="loading-screen">Loading...</div>
    }

    return (
        <div style={{ paddingBottom: '80px' }}>
            {children}
            <BottomNav />
        </div>
    )
}
