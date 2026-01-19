'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/database/supabase'
import { AnnouncementCard } from '@/components/ui/AnnouncementCard'
import { Loading } from '@/components/ui/Loading'
import Link from 'next/link'
import { Activity, ChevronRight, UserCircle } from 'lucide-react'

export default function GuestHomePage() {
    const [announcements, setAnnouncements] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [guestName, setGuestName] = useState<string | null>(null)
    const [activeOrders, setActiveOrders] = useState<any[]>([])

    useEffect(() => {
        async function init() {
            setLoading(true)
            const name = localStorage.getItem('guest_name')
            const phone = localStorage.getItem('guest_phone')

            if (name) setGuestName(name)

            // 1. Fetch announcements
            const { data: news } = await supabase
                .from('announcements')
                .select('*')
                .eq('active', true)
                .order('created_at', { ascending: false })

            if (news) setAnnouncements(news)

            // 2. Fetch active orders by phone if available
            if (phone) {
                const { data: orders } = await supabase
                    .from('orders')
                    .select('*')
                    .filter('guest_info->>phone', 'eq', phone)
                    .in('status', ['pending', 'preparing', 'ready'])
                    .order('created_at', { ascending: false })

                if (orders) setActiveOrders(orders)
            }

            setLoading(false)
        }
        init()
    }, [])

    if (loading) {
        return <Loading fullScreen message="Setting your table..." />
    }

    return (
        <div style={{ paddingBottom: '2rem' }} className="fade-in">
            {/* Hero Section */}
            <div style={{
                height: '35vh',
                minHeight: '280px',
                background: 'linear-gradient(rgba(0,0,0,0.6), rgba(0,0,0,0.6)), url("https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&q=80") center/cover',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                color: 'white',
                padding: 'var(--space-6)',
                marginBottom: 'var(--space-6)',
                borderRadius: '0 0 40px 40px'
            }}>
                <div style={{ maxWidth: '800px' }}>
                    <h1 style={{ color: 'white', fontSize: 'clamp(2.2rem, 8vw, 3.8rem)', marginBottom: 'var(--space-2)', fontFamily: 'var(--font-serif)' }}>
                        {guestName ? `Bentornato, ${guestName.split(' ')[0]}` : 'Benvenuti'}
                    </h1>
                    <p style={{ fontSize: 'clamp(0.9rem, 4vw, 1.1rem)', opacity: 0.9, fontWeight: 500, fontFamily: 'var(--font-sans)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
                        Ai Cavalli • Italian Dining
                    </p>
                </div>
            </div>

            <div className="container">
                {/* Active Orders Section */}
                {activeOrders.length > 0 && (
                    <div style={{ marginBottom: '2.5rem' }}>
                        <h2 style={{ marginBottom: 'var(--space-4)', fontSize: '1.5rem', fontFamily: 'var(--font-serif)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '8px', height: '24px', background: 'var(--primary)', borderRadius: '4px' }} />
                            Your Active Orders
                        </h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {activeOrders.map(order => (
                                <Link
                                    key={order.id}
                                    href={`/guest/status?orderId=${order.id}`}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        background: 'white',
                                        padding: '1.25rem',
                                        borderRadius: '20px',
                                        boxShadow: '0 4px 15px rgba(0,0,0,0.05)',
                                        border: '1px solid var(--border)',
                                        textDecoration: 'none',
                                        color: 'inherit',
                                        transition: 'transform 0.2s'
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                                    onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                        <div style={{
                                            padding: '10px',
                                            background: 'rgba(192, 39, 45, 0.1)',
                                            borderRadius: '12px',
                                            color: 'var(--primary)'
                                        }}>
                                            <Activity size={20} />
                                        </div>
                                        <div>
                                            <p style={{ margin: 0, fontWeight: 700, fontSize: '1rem' }}>Order #{order.id.slice(0, 8).toUpperCase()}</p>
                                            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Status: {order.status.toUpperCase()}</p>
                                        </div>
                                    </div>
                                    <ChevronRight size={20} color="var(--primary)" />
                                </Link>
                            ))}
                        </div>
                    </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
                    <h2 style={{ margin: 0, fontSize: '1.75rem', fontFamily: 'var(--font-serif)' }}>
                        Latest News & Events
                    </h2>
                    {guestName && (
                        <button
                            onClick={() => {
                                localStorage.removeItem('guest_name');
                                localStorage.removeItem('guest_phone');
                                window.location.reload();
                            }}
                            style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer' }}
                        >
                            Change Guest
                        </button>
                    )}
                </div>

                {!guestName && (
                    <Link href="/guest/login" style={{ textDecoration: 'none' }}>
                        <div style={{
                            background: 'white',
                            padding: '1.5rem',
                            borderRadius: '24px',
                            border: '2px dashed var(--primary)',
                            textAlign: 'center',
                            marginBottom: '2.5rem',
                            transition: 'all 0.3s ease'
                        }}>
                            <div style={{
                                width: '48px',
                                height: '48px',
                                background: 'rgba(192, 39, 45, 0.1)',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                margin: '0 auto 12px',
                                color: 'var(--primary)'
                            }}>
                                <UserCircle size={24} />
                            </div>
                            <h3 style={{ margin: 0, color: 'var(--text)', fontSize: '1.1rem' }}>Check-in as Guest</h3>
                            <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Fast-track your orders and track real-time status</p>
                        </div>
                    </Link>
                )}

                {announcements.length > 0 ? (
                    <div className="fade-in">
                        {announcements.map((item) => (
                            <AnnouncementCard key={item.id} announcement={item} />
                        ))}
                    </div>
                ) : (
                    <div style={{
                        textAlign: 'center',
                        padding: 'var(--space-12) var(--space-6)',
                        background: 'var(--surface)',
                        borderRadius: 'var(--radius-lg)',
                        border: '1px solid var(--border)',
                        boxShadow: 'var(--shadow-sm)'
                    }}>
                        <p style={{ marginBottom: 'var(--space-2)', fontSize: '1.25rem', fontWeight: 600 }}>No news today</p>
                        <p style={{ color: 'var(--text-muted)' }}>We'll post updates here as they come.</p>
                    </div>
                )}
            </div>
        </div>
    )
}
