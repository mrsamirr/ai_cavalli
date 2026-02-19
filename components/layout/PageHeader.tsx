'use client'

import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

interface PageHeaderProps {
    title: string
    backHref: string
}

export function PageHeader({ title, backHref }: PageHeaderProps) {
    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
            marginBottom: 'var(--space-8)',
        }}>
            <Link
                href={backHref}
                style={{
                    color: 'var(--primary)',
                    display: 'flex',
                    alignItems: 'center',
                }}
            >
                <ChevronLeft size={32} />
            </Link>
            <h1 style={{
                margin: 0,
                fontSize: '2.5rem',
                fontFamily: 'var(--font-serif)',
            }}>
                {title}
            </h1>
        </div>
    )
}
