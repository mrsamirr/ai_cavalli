'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/database/supabase'
import { AnnouncementCard } from '@/components/ui/AnnouncementCard'
import { Loading } from '@/components/ui/Loading'

export default function GuestHomePage() {
    const [announcements, setAnnouncements] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function fetchNews() {
            const { data } = await supabase
                .from('announcements')
                .select('*')
                .eq('active', true)
                .order('created_at', { ascending: false })

            if (data) {
                setAnnouncements(data)
            }
            setLoading(false)
        }
        fetchNews()
    }, [])

    if (loading) {
        return <Loading fullScreen message="Welcome to Ai Cavalli..." />
    }

    return (
        <div style={{ paddingBottom: '2rem' }} className="fade-in">
            {/* Hero Section */}
            <div style={{
                height: '40vh',
                minHeight: '300px',
                background: 'linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5)), url("https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&q=80&w=1600") center/cover',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                color: 'white',
                padding: 'var(--space-6)',
                marginBottom: 'var(--space-8)'
            }}>
                <div style={{ maxWidth: '800px' }}>
                    <h1 style={{ color: 'white', fontSize: 'clamp(2rem, 8vw, 3.5rem)', marginBottom: 'var(--space-3)' }}>
                        Guest Welcome
                    </h1>
                    <p style={{ fontSize: 'clamp(1rem, 4vw, 1.25rem)', opacity: 0.9, fontWeight: 500, fontFamily: 'var(--font-sans)', letterSpacing: '0.05em' }}>
                        AUTHENTIC CULINARY EXCELLENCE
                    </p>
                </div>
            </div>

            <div className="container">
                <h2 style={{ marginBottom: 'var(--space-6)', fontSize: '1.75rem', fontFamily: 'var(--font-serif)' }}>
                    Latest News & Events
                </h2>

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
