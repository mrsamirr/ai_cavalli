'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/database/supabase'
import { sanitizePhone } from '@/lib/utils/phone'
import { AnnouncementCard } from '@/components/ui/AnnouncementCard'
import { Loading } from '@/components/ui/Loading'
import Link from 'next/link'
import { Activity, ChevronRight, UserCircle, Calendar } from 'lucide-react'

export default function GuestHomePage() {
    const [announcements, setAnnouncements] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [guestName, setGuestName] = useState<string | null>(null)
    const [activeOrders, setActiveOrders] = useState<any[]>([])

    // Design Tokens
    const ITALIAN_RED = '#A91E22';

    useEffect(() => {
        let channel: any;
        async function init() {
            setLoading(true)
            const name = localStorage.getItem('guest_name')
            const phone = localStorage.getItem('guest_phone')

            if (name) setGuestName(name)

            // Fetch announcements
            const { data: news } = await supabase
                .from('announcements')
                .select('*')
                .eq('active', true)
                .order('created_at', { ascending: false })

            if (news) setAnnouncements(news)

            // Fetch and Subscribe to orders
            if (phone) {
                const fetchOrders = async () => {
                    const { data: orders } = await supabase
                        .from('orders')
                        .select('*')
                        .contains('guest_info', { phone: sanitizePhone(phone) })
                        .in('status', ['pending', 'preparing', 'ready'])
                        .order('created_at', { ascending: false })

                    if (orders) setActiveOrders(orders)
                }
                await fetchOrders()
            }
            setLoading(false)
        }
        init()
    }, [])

    if (loading) return <Loading fullScreen message="Ai Cavalli is preparing your table..." />

    return (
        <div style={{ paddingBottom: '4rem', background: '#FDFBF7', minHeight: '100vh' }} className="fade-in">
            {/* Hero Section */}
            <div style={{
                height: '35vh',
                minHeight: '300px',
                background: `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.6)), url("https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&q=80") center/cover`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                color: 'white',
                padding: '2rem',
                marginBottom: '3rem',
                borderRadius: '0 0 40px 40px'
            }}>
                <div style={{ maxWidth: '800px' }}>
                    <span style={{ letterSpacing: '0.4em', fontSize: '0.7rem', opacity: 0.8, textTransform: 'uppercase' }}>
                        Welcome
                    </span>
                    <h1 style={{ color: 'white', fontSize: 'clamp(2.5rem, 8vw, 4rem)', margin: '0.5rem 0', fontFamily: 'var(--font-serif)' }}>
                        {guestName ? `${guestName.split(' ')[0]}` : 'Guest'}
                    </h1>
                    <div style={{ width: '40px', height: '2px', background: '#A91E22', margin: '1rem auto' }} />
                </div>
            </div>

            <div className="container">
                {/* Active Orders - (Previous Active Order Section Logic) */}

                {/* News Section Header */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-end',
                    marginBottom: '2.5rem',
                    borderBottom: '1px solid #EAEAEA',
                    paddingBottom: '1rem'
                }}>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '2.2rem', fontFamily: 'var(--font-serif)', color: '#1A1A1A' }}>
                            The Journal
                        </h2>
                        <p style={{ margin: 0, color: '#888', fontSize: '0.85rem', letterSpacing: '0.05em' }}>
                            STORIES, EVENTS & CULINARY UPDATES
                        </p>
                    </div>
                </div>

                {/* News Grid */}
                {announcements.length > 0 ? (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
                        gap: '2.5rem'
                    }}>
                        {announcements.map((item) => (
                            <AnnouncementCard key={item.id} announcement={item} />
                        ))}
                    </div>
                ) : (
                    <div style={{ textAlign: 'center', padding: '5rem 0', opacity: 0.4 }}>
                        <p style={{ fontFamily: 'var(--font-serif)', fontSize: '1.2rem' }}>No news updates at this time.</p>
                    </div>
                )}
            </div>
        </div>
    )
}