'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/context'
import { supabase } from '@/lib/database/supabase'
import { sanitizePhone } from '@/lib/utils/phone'
import { Button } from '@/components/ui/button'
import { User, KeyRound, Utensils, ArrowLeft, ShieldCheck, ClipboardCheck } from 'lucide-react'
import styles from './page.module.css'

export default function LoginPage() {
    const [view, setView] = useState<'select' | 'login' | 'signup' | 'reset-pin'>('select')
    const [loginRole, setLoginRole] = useState<'student' | 'staff'>('student')

    const [phone, setPhone] = useState('')
    const [pin, setPin] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    const { signIn } = useAuth()
    const router = useRouter()

    const handleRoleSelect = (role: 'student' | 'staff') => {
        setLoginRole(role)
        setView('login')
        setError('')
        setPhone('')
        setPin('')
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            const { error: authError } = await signIn(phone, pin)
            if (authError) {
                console.error('Login error:', authError)
                setError(authError.message || 'Invalid credentials')
            } else {
                // Redirect based on role
                if (loginRole === 'staff') {
                    router.push('/kitchen')
                } else {
                    router.push('/home')
                }
            }
        } catch (err) {
            setError('An unexpected error occurred')
        } finally {
            setLoading(false)
        }
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
                            <button className={styles.premiumCard} onClick={() => router.push('/guest/login')}>
                                <div className={styles.iconCircle}><Utensils size={24} /></div>
                                <div className={styles.cardText}>
                                    <h3>Guest Entry</h3>
                                    <p>Continue to the culinary experience</p>
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
                        <button onClick={() => setView('select')} className={styles.backArrow}>
                            <ArrowLeft size={20} />
                        </button>

                        <div className={styles.cardHeader}>
                            <h2 className={styles.cardTitle}>
                                {loginRole === 'staff' ? 'Staff Verification' : 'Rider Identity'}
                            </h2>
                            <p className={styles.cardSubtitle}>Enter secure credentials</p>
                        </div>

                        <form className={styles.premiumForm} onSubmit={handleSubmit}>
                            <div className={styles.inputGroup}>
                                <label>PHONE NUMBER</label>
                                <input
                                    type="tel"
                                    placeholder="000 000 0000"
                                    value={phone}
                                    onChange={(e) => setPhone(sanitizePhone(e.target.value))}
                                    required
                                    maxLength={10}
                                />
                            </div>

                            <div className={styles.inputGroup}>
                                <label>ACCESS PIN</label>
                                <input
                                    type="password"
                                    placeholder="••••••"
                                    maxLength={6}
                                    value={pin}
                                    onChange={(e) => {
                                        const val = e.target.value.replace(/\D/g, '')
                                        setPin(val.slice(0, 6))
                                    }}
                                    required
                                    minLength={6}
                                />
                            </div>

                            {error && <div className={styles.errorBanner}>{error}</div>}

                            <Button
                                type="submit"
                                className={styles.actionButton}
                                isLoading={loading}
                            >
                                AUTHORIZE ENTRY
                            </Button>

                            <div className={styles.formFooter}>
                                <button type="button" onClick={() => alert('PIN reset feature - check implementation_plan.md')}>Forgot PIN?</button>
                                <span className={styles.dot} />
                                <button type="button" onClick={() => alert('Signup feature - check implementation_plan.md')}>Request Access</button>
                            </div>
                        </form>
                    </div>
                )}
            </div>
        </main>
    )
}