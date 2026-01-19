'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/context'
import { supabase } from '@/lib/database/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { User, KeyRound, Utensils } from 'lucide-react'
import styles from './page.module.css'

export default function LoginPage() {
    const [view, setView] = useState<'select' | 'login' | 'signup'>('select')
    const [loginRole, setLoginRole] = useState<'student' | 'staff'>('student')

    const [phone, setPhone] = useState('')
    const [pin, setPin] = useState('')
    const [name, setName] = useState('')
    const [parentName, setParentName] = useState('')
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

    const handleGuest = () => {
        router.push('/guest/home')
    }

    const handleSignup = () => {
        setView('signup')
        setError('')
        setPhone('')
        setPin('')
        setName('')
        setParentName('')
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

    const handleSignupSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            const email = `${phone.trim()}@example.com`

            // Create auth user
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email,
                password: pin,
            })

            if (authError) {
                setError(authError.message)
                setLoading(false)
                return
            }

            if (!authData.user) {
                setError('Failed to create account')
                setLoading(false)
                return
            }

            // Create database record
            const { error: dbError } = await supabase.from('users').insert({
                id: authData.user.id,
                phone: phone.trim(),
                pin,
                name,
                role: loginRole, // Use selected role
                parent_name: loginRole === 'student' ? (parentName || null) : null
            })

            if (dbError) {
                setError('Account created but failed to save details. Please contact admin.')
                setLoading(false)
                return
            }

            // Auto-login after signup
            const { error: loginError } = await signIn(phone, pin)
            if (loginError) {
                console.warn('Auto-login failed:', loginError)
                setError(`Account created! But could not log in: ${loginError.message}. Please try logging in manually.`)
                setView('login')
            } else {
                router.push('/home')
            }
        } catch (err: any) {
            setError(err.message || 'An unexpected error occurred')
        } finally {
            setLoading(false)
        }
    }

    // SELECTION VIEW
    if (view === 'select') {
        return (
            <main className={styles.main}>
                <div className={styles.container}>
                    <h1 className={styles.title}>Ai Cavalli</h1>
                    <p className={styles.subtitle}>Please select your role</p>

                    <div className={styles.grid}>
                        <button className={styles.roleCard} onClick={() => handleRoleSelect('student')}>
                            <User size={48} className={styles.icon} />
                            <span>Rider Login</span>
                        </button>

                        <button className={styles.roleCard} onClick={handleGuest}>
                            <Utensils size={48} className={styles.icon} />
                            <span>Guest Order</span>
                        </button>
                    </div>

                    <div className={styles.footer}>
                        <button className={styles.staffLink} onClick={() => handleRoleSelect('staff')}>
                            <KeyRound size={16} />
                            Staff Login
                        </button>
                    </div>
                </div>
            </main>
        )
    }

    // SIGNUP VIEW
    if (view === 'signup') {
        return (
            <main className={styles.main}>
                <div className={styles.card}>
                    <button onClick={() => setView('select')} className={styles.backButton}>← Back</button>

                    <h1 className={styles.title}>Create Account</h1>
                    <p className={styles.subtitle}>Register to access the system</p>

                    <form onSubmit={handleSignupSubmit} className={styles.form}>
                        <Input
                            label="Your Name"
                            type="text"
                            placeholder="John Doe"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                        />
                        <Input
                            label="Phone Number"
                            type="tel"
                            placeholder="1234567890"
                            value={phone}
                            onChange={(e) => {
                                const val = e.target.value
                                const numeric = val.replace(/\D/g, '')
                                const sanitized = numeric.startsWith('0') ? numeric.slice(1) : numeric
                                const truncated = sanitized.slice(0, 10)
                                setPhone(truncated)
                            }}
                            required
                            maxLength={10}
                        />

                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 500 }}>
                                Role
                            </label>
                            <select
                                value={loginRole}
                                onChange={(e) => setLoginRole(e.target.value as 'student' | 'staff')}
                                style={{
                                    width: '100%',
                                    padding: '0.75rem',
                                    borderRadius: '8px',
                                    border: '1px solid var(--border)',
                                    fontSize: '1rem',
                                    backgroundColor: 'var(--surface)'
                                }}
                            >
                                <option value="student">Rider</option>
                                <option value="staff">Staff</option>
                                <option value="kitchen_manager">Kitchen Manager</option>
                            </select>
                        </div>

                        {loginRole === 'student' && (
                            <Input
                                label="Parent Name (Optional)"
                                type="text"
                                placeholder="Parent's name"
                                value={parentName}
                                onChange={(e) => setParentName(e.target.value)}
                            />
                        )}

                        <Input
                            label="Create PIN (6 digits)"
                            type="password"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            placeholder="123456"
                            value={pin}
                            onChange={(e) => {
                                const val = e.target.value.replace(/\D/g, '')
                                setPin(val.slice(0, 6))
                            }}
                            required
                            minLength={6}
                            maxLength={6}
                        />

                        {error && <div className={styles.error}>{error}</div>}

                        <Button type="submit" isLoading={loading} className={styles.button}>
                            Create Account
                        </Button>

                        <div className={styles.guestLink}>
                            <a onClick={() => setView('login')} style={{ cursor: 'pointer' }}>
                                Already have an account? Login
                            </a>
                        </div>
                    </form>
                </div>
            </main>
        )
    }

    // LOGIN FORM VIEW
    return (
        <main className={styles.main}>
            <div className={styles.card}>
                <button onClick={() => setView('select')} className={styles.backButton}>← Back</button>

                <h1 className={styles.title}>
                    {loginRole === 'student' ? 'Rider Portal' : 'Staff Portal'}
                </h1>
                <p className={styles.subtitle}>Enter your credentials</p>

                <form onSubmit={handleSubmit} className={styles.form}>
                    <Input
                        label="Phone Number"
                        type="tel"
                        placeholder="1234567890"
                        value={phone}
                        onChange={(e) => {
                            const val = e.target.value
                            const numeric = val.replace(/\D/g, '')
                            const sanitized = numeric.startsWith('0') ? numeric.slice(1) : numeric
                            const truncated = sanitized.slice(0, 10)
                            setPhone(truncated)
                        }}
                        required
                        maxLength={10}
                    />
                    <Input
                        label="PIN"
                        type="password"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        placeholder="******"
                        value={pin}
                        onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '')
                            setPin(val.slice(0, 6))
                        }}
                        required
                        minLength={6}
                        maxLength={6}
                    />

                    {error && <div className={styles.error}>{error}</div>}

                    <Button type="submit" isLoading={loading} className={styles.button}>
                        Login
                    </Button>

                    <div className={styles.guestLink}>
                        <a onClick={handleSignup} style={{ cursor: 'pointer' }}>
                            Don't have an account? Create one
                        </a>
                    </div>
                </form>
            </div>
        </main>
    )
}
