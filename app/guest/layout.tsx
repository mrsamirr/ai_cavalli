'use client'

import { GuestBottomNav } from '@/components/layout/GuestBottomNav'

export default function GuestLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div style={{ paddingBottom: '80px' }}>
            {children}
            <GuestBottomNav />
        </div>
    )
}
