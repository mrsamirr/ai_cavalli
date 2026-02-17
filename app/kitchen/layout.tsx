'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth/context'
import { ProtectedRoute } from '@/lib/auth/protected-route'
import { TopNav } from '@/components/layout/TopNav'

export default function KitchenLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const { user, isLoading } = useAuth()
    const [isHydrated, setIsHydrated] = useState(false)

    useEffect(() => {
        setIsHydrated(true)
    }, [])

    if (!isHydrated || isLoading) {
        return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading Kitchen Portal...</div>
    }

    if (!user) {
        return null
    }

    const getRoleLabel = () => {
        switch (user.role) {
            case 'ADMIN': return 'Admin'
            case 'KITCHEN': return 'Kitchen Manager'
            default: return user.role
        }
    }

    const links = [
        { label: 'Orders', href: '/kitchen' },
        { label: 'Specials', href: '/kitchen/specials' },
        ...(user.role === 'ADMIN' ? [
            { label: 'Menu', href: '/admin/menu' },
            { label: 'Admin', href: '/admin', muted: true },
        ] : []),
    ]

    return (
        <ProtectedRoute requiredRoles={['KITCHEN', 'ADMIN']}>
            <div className="kitchen-layout">
                <TopNav
                    title="Kitchen"
                    links={links}
                    accentColor="var(--surface)"
                    accentText="var(--text)"
                    roleLabel={getRoleLabel()}
                />
                <main style={{ padding: '2rem', background: '#f5f5f5', minHeight: 'calc(100vh - 60px)' }}>
                    {children}
                </main>
            </div>
        </ProtectedRoute>
    )
}
