'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Menu, ShoppingCart, Clock } from 'lucide-react'
import clsx from 'clsx'
import styles from './BottomNav.module.css'

const tabs = [
    { name: 'Home', href: '/guest/home', icon: Home, ariaLabel: 'Go to home page' },
    { name: 'Menu', href: '/guest/menu', icon: Menu, ariaLabel: 'View menu' },
    { name: 'Cart', href: '/guest/cart', icon: ShoppingCart, ariaLabel: 'View shopping cart' },
    { name: 'Status', href: '/guest/status', icon: Clock, ariaLabel: 'View order status' },
]

export function GuestBottomNav() {
    const pathname = usePathname()

    return (
        <nav className={styles.nav} role="navigation" aria-label="Guest navigation">
            {tabs.map((tab) => {
                const Icon = tab.icon
                const isActive = pathname.startsWith(tab.href)
                return (
                    <Link
                        key={tab.name}
                        href={tab.href}
                        className={clsx(styles.link, isActive && styles.active)}
                        aria-label={tab.ariaLabel}
                        aria-current={isActive ? 'page' : undefined}
                    >
                        <div className={styles.iconWrapper}>
                            <Icon
                                size={24}
                                strokeWidth={isActive ? 2.5 : 2}
                                aria-hidden="true"
                            />
                        </div>
                        <span className={styles.label}>{tab.name}</span>
                    </Link>
                )
            })}
        </nav>
    )
}