'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/context'
import { ProtectedRoute } from '@/lib/auth/protected-route'
import Link from 'next/link'

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const { user, isLoading } = useAuth()
    const router = useRouter()

    if (isLoading) {
        return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading Admin Portal...</div>
    }

    if (!user) {
        return null
    }

    return (
        <ProtectedRoute requiredRoles={['ADMIN']}>
            <div className="admin-layout">
                <header style={{
                    background: '#2c2c2c',
                    color: 'white',
                    padding: '1rem 2rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <h1 style={{ fontSize: '1.5rem', margin: 0, color: 'white' }}>Admin Portal</h1>
                    <nav style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                        <Link href="/admin" style={{ color: 'white', textDecoration: 'none' }}>Analytics</Link>
                        <Link href="/admin/menu" style={{ color: 'white', textDecoration: 'none' }}>Menu</Link>
                        <Link href="/admin/cms" style={{ color: 'white', textDecoration: 'none' }}>CMS</Link>
                        <Link href="/admin/users" style={{ color: 'white', textDecoration: 'none' }}>Users</Link>
                        <Link href="/kitchen" style={{ color: '#aaa', textDecoration: 'none' }}>Kitchen View</Link>
                        <div style={{ width: '1px', height: '20px', background: '#555' }}></div>
                        <span style={{ color: '#aaa', fontSize: '0.9rem' }}>{user.name}</span>
                        <button
                            onClick={() => router.push('/api/auth/logout')}
                            style={{
                                padding: '0.5rem 1rem',
                                background: '#555',
                                color: 'white',
                                border: '1px solid #666',
                                borderRadius: '4px',
                                cursor: 'pointer'
                            }}
                        >
                            Logout
                        </button>
                    </nav>
                </header>
                <main style={{ padding: '2rem', background: '#f5f5f5', minHeight: 'calc(100vh - 64px)' }}>
                    {children}
                </main>
            </div>
        </ProtectedRoute>
    )
}
