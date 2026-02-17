'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth/context'
import { LogOut, ChevronDown } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'

interface NavLink {
    label: string
    href: string
    muted?: boolean
}

interface TopNavProps {
    title: string
    links: NavLink[]
    accentColor?: string       // header background
    accentText?: string        // header text color
    roleLabel?: string         // shown next to user name
}

export function TopNav({ title, links, accentColor = '#1A1A1A', accentText = '#FFFFFF', roleLabel }: TopNavProps) {
    const { user, logout } = useAuth()
    const pathname = usePathname()
    const [menuOpen, setMenuOpen] = useState(false)
    const [loggingOut, setLoggingOut] = useState(false)
    const menuRef = useRef<HTMLDivElement>(null)

    // Close menu on outside click
    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setMenuOpen(false)
            }
        }
        if (menuOpen) document.addEventListener('mousedown', handleClick)
        return () => document.removeEventListener('mousedown', handleClick)
    }, [menuOpen])

    const handleLogout = async () => {
        setLoggingOut(true)
        try {
            await logout()
        } catch {
            setLoggingOut(false)
        }
    }

    return (
        <header style={{
            background: accentColor,
            color: accentText,
            padding: '0 1.5rem',
            height: '60px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            position: 'sticky',
            top: 0,
            zIndex: 100,
            boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
        }}>
            {/* Left: Title */}
            <h1 style={{
                margin: 0,
                fontSize: '1.2rem',
                fontWeight: 800,
                letterSpacing: '-0.02em',
                whiteSpace: 'nowrap',
                fontFamily: 'var(--font-serif)',
            }}>
                {title}
            </h1>

            {/* Center: Nav links (hidden on very small screens) */}
            <nav style={{
                display: 'flex',
                gap: '0.25rem',
                alignItems: 'center',
            }}>
                {links.map((link) => {
                    const isActive = pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href))
                    return (
                        <Link
                            key={link.href}
                            href={link.href}
                            style={{
                                color: link.muted
                                    ? `${accentText}88`
                                    : isActive ? accentText : `${accentText}cc`,
                                textDecoration: 'none',
                                fontSize: '0.85rem',
                                fontWeight: isActive ? 700 : 500,
                                padding: '0.4rem 0.75rem',
                                borderRadius: '8px',
                                background: isActive ? `${accentText}15` : 'transparent',
                                transition: 'all 0.15s ease',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            {link.label}
                        </Link>
                    )
                })}
            </nav>

            {/* Right: User menu */}
            <div ref={menuRef} style={{ position: 'relative' }}>
                <button
                    onClick={() => setMenuOpen(!menuOpen)}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: `${accentText}10`,
                        border: `1px solid ${accentText}20`,
                        borderRadius: '10px',
                        padding: '0.35rem 0.75rem',
                        color: accentText,
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        transition: 'all 0.15s ease',
                    }}
                    aria-label="User menu"
                >
                    {/* Avatar circle */}
                    <span style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        background: `${accentText}25`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                    }}>
                        {user?.name?.charAt(0)?.toUpperCase() || '?'}
                    </span>
                    <span style={{ maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {user?.name || 'User'}
                    </span>
                    <ChevronDown size={14} style={{
                        transform: menuOpen ? 'rotate(180deg)' : 'rotate(0)',
                        transition: 'transform 0.2s ease',
                    }} />
                </button>

                {/* Dropdown */}
                {menuOpen && (
                    <div style={{
                        position: 'absolute',
                        right: 0,
                        top: 'calc(100% + 8px)',
                        background: '#fff',
                        borderRadius: '12px',
                        boxShadow: '0 8px 30px rgba(0,0,0,0.15), 0 2px 8px rgba(0,0,0,0.06)',
                        border: '1px solid #e5e5e5',
                        minWidth: '220px',
                        overflow: 'hidden',
                        animation: 'fadeInDown 0.15s ease',
                        zIndex: 200,
                    }}>
                        {/* User info */}
                        <div style={{
                            padding: '0.875rem 1rem',
                            borderBottom: '1px solid #f0f0f0',
                        }}>
                            <div style={{
                                fontWeight: 700,
                                fontSize: '0.9rem',
                                color: '#1a1a1a',
                                marginBottom: '2px',
                            }}>
                                {user?.name}
                            </div>
                            <div style={{
                                fontSize: '0.75rem',
                                color: '#888',
                                fontWeight: 500,
                            }}>
                                {roleLabel || user?.role || 'User'}
                                {user?.phone && ` · ${user.phone}`}
                            </div>
                        </div>

                        {/* Logout */}
                        <button
                            onClick={handleLogout}
                            disabled={loggingOut}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                width: '100%',
                                padding: '0.75rem 1rem',
                                border: 'none',
                                background: 'transparent',
                                cursor: loggingOut ? 'wait' : 'pointer',
                                color: '#dc2626',
                                fontSize: '0.85rem',
                                fontWeight: 600,
                                transition: 'background 0.15s ease',
                                textAlign: 'left',
                                opacity: loggingOut ? 0.6 : 1,
                            }}
                            onMouseEnter={(e) => { if (!loggingOut) e.currentTarget.style.background = '#fef2f2' }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                        >
                            <LogOut size={16} />
                            {loggingOut ? 'Signing out...' : 'Sign Out'}
                        </button>
                    </div>
                )}
            </div>
        </header>
    )
}
