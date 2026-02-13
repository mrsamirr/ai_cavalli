'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/context'
import { ProtectedRoute } from '@/lib/auth/protected-route'
import Link from 'next/link'

export default function KitchenLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const { user, isLoading } = useAuth()
    const router = useRouter()
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
            case 'ADMIN':
                return 'Admin'
            case 'KITCHEN':
                return 'Kitchen Manager'
            default:
                return user.role
        }
    }

    return (
        <ProtectedRoute requiredRoles={['KITCHEN', 'ADMIN']}>
            <div className="kitchen-layout">
                <header style={{
                    background: 'var(--surface)',
                    borderBottom: '1px solid var(--border)',
                    padding: '1rem 2rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <h1 style={{ fontSize: '1.5rem', margin: 0 }}>Kitchen Portal</h1>
                    <nav style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        <Link href="/kitchen">Orders</Link>
                        <Link href="/kitchen/specials">Specials</Link>
                        {user.role === 'ADMIN' && (
                            <>
                                <Link href="/admin/users">Users</Link>
                                <Link href="/admin/menu">Menu</Link>
                            </>
                        )}
                        <div style={{ width: '1px', height: '20px', background: '#ccc' }}></div>
                        <span style={{ fontWeight: 'bold' }}>
                            {user.name} ({getRoleLabel()})
                        </span>
                        {/* <button
                            onClick={() => router.push('/api/auth/logout')}
                            style={{
                                padding: '0.5rem 1rem',
                                background: '#f0f0f0',
                                border: '1px solid #ccc',
                                borderRadius: '4px',
                                cursor: 'pointer'
                            }}
                        >
                            Logout
                        </button> */}
                    </nav>
                </header>
                <main style={{ padding: '2rem', background: '#f5f5f5', minHeight: 'calc(100vh - 64px)' }}>
                    {children}
                </main>
            </div>
        </ProtectedRoute>
    )
}
