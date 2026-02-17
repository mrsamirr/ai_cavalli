'use client'

import { useAuth } from '@/lib/auth/context'
import { ProtectedRoute } from '@/lib/auth/protected-route'
import { TopNav } from '@/components/layout/TopNav'

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const { user, isLoading } = useAuth()

    if (isLoading) {
        return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading Admin Portal...</div>
    }

    if (!user) {
        return null
    }

    const links = [
        { label: 'Analytics', href: '/admin' },
        { label: 'Menu', href: '/admin/menu' },
        { label: 'CMS', href: '/admin/cms' },
        { label: 'Users', href: '/admin/users' },
        { label: 'Kitchen', href: '/kitchen', muted: true },
    ]

    return (
        <ProtectedRoute requiredRoles={['ADMIN']}>
            <div className="admin-layout">
                <TopNav
                    title="Admin Portal"
                    links={links}
                    accentColor="#1A1A1A"
                    accentText="#FFFFFF"
                    roleLabel="Admin"
                />
                <main style={{ padding: '2rem', background: '#f5f5f5', minHeight: 'calc(100vh - 60px)' }}>
                    {children}
                </main>
            </div>
        </ProtectedRoute>
    )
}
