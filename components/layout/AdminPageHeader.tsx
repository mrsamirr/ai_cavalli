'use client'

import Link from 'next/link'
import { ArrowLeft, type LucideIcon } from 'lucide-react'

interface AdminPageHeaderProps {
    title: string
    subtitle?: string
    icon: LucideIcon
    backHref?: string
}

export function AdminPageHeader({ title, subtitle, icon: Icon, backHref }: AdminPageHeaderProps) {
    return (
        <div style={{
            marginBottom: '2rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1.25rem',
            flexWrap: 'wrap',
        }}>
            {backHref && (
                <Link href={backHref} style={{ textDecoration: 'none' }}>
                    <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '50%',
                        background: 'white',
                        border: '2px solid var(--primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease',
                        boxShadow: '0 2px 8px rgba(var(--primary-rgb), 0.1)',
                        color: 'var(--primary)',
                    }}>
                        <ArrowLeft size={22} />
                    </div>
                </Link>
            )}
            <div style={{
                background: 'var(--primary)',
                padding: '14px',
                borderRadius: '16px',
                boxShadow: '0 4px 16px rgba(var(--primary-rgb), 0.25)',
            }}>
                <Icon size={28} color="white" />
            </div>
            <div>
                <h1 style={{
                    fontSize: 'clamp(2rem, 5vw, 3rem)',
                    fontWeight: '600',
                    margin: 0,
                    color: 'var(--text)',
                    letterSpacing: '-0.01em',
                }}>
                    {title}
                </h1>
                {subtitle && (
                    <p style={{
                        color: 'var(--text-muted)',
                        margin: '4px 0 0 0',
                        fontSize: 'clamp(0.9rem, 2vw, 1.1rem)',
                        fontWeight: '400',
                        fontStyle: 'italic',
                    }}>
                        {subtitle}
                    </p>
                )}
            </div>
        </div>
    )
}
