'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/auth/context'
import { Button } from '@/components/ui/button'
import { User, KeyRound, Utensils, ArrowLeft, ShieldCheck } from 'lucide-react'
import styles from './page.module.css'

export default function LoginPage() {
    const [view, setView] = useState<'select' | 'login'>('select')
    const [loginRole, setLoginRole] = useState<'student' | 'staff' | 'guest'>('student')

    // Guest fields
    const [guestName, setGuestName] = useState('')
    const [guestPhone, setGuestPhone] = useState('')
    const [tableName, setTableName] = useState('')
    const [numGuests, setNumGuests] = useState('1')

    // Staff/Rider fields
    const [phone, setPhone] = useState('')
    const [pin, setPin] = useState('')

    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    const { signIn } = useAuth()

    const handleRoleSelect = (role: 'student' | 'staff' | 'guest') => {
        setLoginRole(role)
        setView('login')
        setError('')
        // Reset all fields
        setGuestName('')
        setGuestPhone('')
        setTableName('')
        setNumGuests('1')
        setPhone('')
        setPin('')
    }

    const handleGuestLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            const response = await fetch('/api/auth/guest-login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: guestName.trim(),
                    phone: guestPhone,
                    tableName: tableName.trim(),
                    numGuests: numGuests
                })
            })

            const data = await response.json()

            if (data.success) {
                // Store session info for cart and orders
                localStorage.setItem('user', JSON.stringify(data.user))
                localStorage.setItem('guest_session', JSON.stringify(data.session))
                localStorage.setItem('guest_phone', guestPhone)
                localStorage.setItem('is_guest_active', 'true')

                signIn(data.user)
                // Guests use the guest portal
                window.location.href = '/guest/home'
            } else {
                setError(data.error || 'Login failed. Please try again.')
            }
        } catch (err) {
            setError('Network error. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    const handleLoginPIN = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            const response = await fetch('/api/auth/login-pin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone, pin })
            })

            const data = await response.json()

            if (data.success) {
                // Session cookies are set server-side by the SSR client
                localStorage.setItem('user', JSON.stringify(data.user))
                signIn(data.user)

                // Redirect based on role
                const targetUrl = (data.user.role === 'kitchen_manager' || data.user.role === 'admin' || data.user.role === 'staff')
                    ? '/kitchen'
                    : '/home'

                // Use replace to prevent back button issues
                window.location.replace(targetUrl)
                return // Important: exit the function after redirect
            } else {
                setError(data.error || 'Invalid phone or PIN')
            }
        } catch (err) {
            console.error('Login error:', err)
            setError('Network error. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    const handleBack = () => {
        setView('select')
        setError('')
    }

    return (
        <main className={styles.main}>
            <div className={styles.overlay} />

            <div className={styles.contentWrapper}>
                {view === 'select' && (
                    <div className={`${styles.container} animate-reveal`}>
                        <header className={styles.header}>
                            <span className={styles.overline}>Dal 1994</span>
                            <h1 className={styles.brandTitle}>Ai Cavalli</h1>
                            <p className={styles.brandSubtitle}>Exclusive Dining & Operations</p>
                        </header>

                        <div className={styles.roleGrid}>
                            <button className={styles.premiumCard} onClick={() => handleRoleSelect('guest')}>
                                <div className={styles.iconCircle}><Utensils size={24} /></div>
                                <div className={styles.cardText}>
                                    <h3>Guest Entry</h3>
                                    <p>Start your dining experience</p>
                                </div>
                            </button>

                            <button className={styles.premiumCard} onClick={() => handleRoleSelect('student')}>
                                <div className={styles.iconCircle}><User size={24} /></div>
                                <div className={styles.cardText}>
                                    <h3>Rider Portal</h3>
                                    <p>Access your logistics dashboard</p>
                                </div>
                            </button>
                        </div>

                        <footer className={styles.selectFooter}>
                            <div className={styles.divider}>
                                <span className={styles.dividerLine}></span>
                                <span className={styles.dividerText}>Authorized Access</span>
                                <span className={styles.dividerLine}></span>
                            </div>

                            <button className={styles.staffProceedButton} onClick={() => handleRoleSelect('staff')}>
                                <div className={styles.staffButtonContent}>
                                    <ShieldCheck size={20} className={styles.staffIcon} />
                                    <div className={styles.staffButtonText}>
                                        <span>Proceed as Staff / Instructor Rider</span>
                                        <small>Internal Personnel Access Only</small>
                                    </div>
                                </div>
                            </button>
                        </footer>
                    </div>
                )}

                {view === 'login' && (
                    <div className={`${styles.authCard} animate-slide-up`}>
                        <button onClick={handleBack} className={styles.backArrow}>
                            <ArrowLeft size={20} />
                        </button>

                        <div className={styles.cardHeader}>
                            <h2 className={styles.cardTitle}>
                                {loginRole === 'guest' ? 'Guest Check-in' : loginRole === 'staff' ? 'Staff Verification' : 'Rider Identity'}
                            </h2>
                            <p className={styles.cardSubtitle}>
                                {loginRole === 'guest'
                                    ? 'Enter your details to start dining'
                                    : 'Enter your credentials'}
                            </p>
                        </div>

                        {loginRole === 'guest' ? (
                            <form className={styles.premiumForm} onSubmit={handleGuestLogin}>
                                <div className={styles.inputGroup}>
                                    <label>YOUR NAME</label>
                                    <input
                                        type="text"
                                        placeholder="Enter your name"
                                        value={guestName}
                                        onChange={(e) => setGuestName(e.target.value.slice(0, 20))}
                                        maxLength={20}
                                        required
                                        autoFocus
                                    />
                                </div>
                                <div className={styles.inputGroup}>
                                    <label>PHONE NUMBER</label>
                                    <input
                                        type="tel"
                                        placeholder="0123456789"
                                        value={guestPhone}
                                        onChange={(e) => setGuestPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                                        required
                                    />
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                                    <div className={styles.inputGroup} style={{ marginBottom: 0 }}>
                                        <label>TABLE NO</label>
                                        <input
                                            type="text"
                                            placeholder="T1, T2..."
                                            value={tableName}
                                            onChange={(e) => setTableName(e.target.value.slice(0, 40))}
                                            maxLength={40}
                                            required
                                        />
                                    </div>
                                    <div className={styles.inputGroup} style={{ marginBottom: 0 }}>
                                        <label>GUESTS</label>
                                        <input
                                            type="number"
                                            min="1"
                                            max="20"
                                            value={numGuests}
                                            onChange={(e) => setNumGuests(e.target.value)}
                                            required
                                        />
                                    </div>
                                </div>

                                {error && <div className={styles.errorBanner}>{error}</div>}

                                <Button
                                    type="submit"
                                    className={styles.actionButton}
                                    isLoading={loading}
                                    disabled={!guestName.trim() || guestPhone.length < 10 || !tableName.trim()}
                                >
                                    <Utensils size={18} style={{ marginRight: '8px' }} />
                                    START DINING
                                </Button>
                            </form>
                        ) : (
                            <form className={styles.premiumForm} onSubmit={handleLoginPIN}>
                                <div className={styles.inputGroup}>
                                    <label>PHONE NUMBER</label>
                                    <input
                                        type="tel"
                                        placeholder="0123456789"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                                        required
                                        autoFocus
                                    />
                                </div>
                                <div className={styles.inputGroup}>
                                    <label>ACCESS PIN</label>
                                    <input
                                        type="password"
                                        placeholder="000000"
                                        value={pin}
                                        onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                        required
                                        maxLength={6}
                                    />
                                </div>

                                {error && <div className={styles.errorBanner}>{error}</div>}

                                <Button
                                    type="submit"
                                    className={styles.actionButton}
                                    isLoading={loading}
                                    disabled={phone.length < 10 || pin.length < 6}
                                >
                                    <KeyRound size={18} style={{ marginRight: '8px' }} />
                                    LOGIN WITH PIN
                                </Button>
                            </form>
                        )}
                    </div>
                )}
            </div>
        </main>
    )
}
