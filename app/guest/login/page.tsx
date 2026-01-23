'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { sanitizePhone } from '@/lib/utils/phone'
import { Button } from '@/components/ui/button'
import { UserCircle, Phone, Hash, Users, ArrowLeft } from 'lucide-react'
import styles from './page.module.css'

export default function GuestLoginPage() {
    const router = useRouter()
    const [name, setName] = useState('')
    const [phone, setPhone] = useState('')
    const [tableName, setTableName] = useState('')
    const [numGuests, setNumGuests] = useState('1')
    const [loading, setLoading] = useState(false)

    const ITALIAN_RED = '#A91E22';

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        const finalPhone = sanitizePhone(phone)
        if (finalPhone.length < 10) {
            alert('Please enter a valid 10-digit phone number')
            setLoading(false)
            return
        }

        localStorage.setItem('guest_name', name.trim())
        localStorage.setItem('guest_phone', finalPhone)
        localStorage.setItem('guest_table', tableName.trim())
        localStorage.setItem('guest_num_guests', numGuests)
        localStorage.setItem('is_guest_active', 'true')

        setTimeout(() => {
            router.push('/guest/home')
        }, 800)
    }

    return (
        <main className={styles.main}>
            <div className={styles.overlay} />

            <div className={styles.contentWrapper}>
                <div className={`${styles.authCard} animate-reveal`}>
                    <button onClick={() => router.push('/login')} className={styles.backArrow}>
                        <ArrowLeft size={20} />
                    </button>

                    <header style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                        <span className={styles.overline}>Benvenuto</span>
                        <h2 className={styles.cardTitle}>Guest Check-in</h2>
                        <p className={styles.cardSubtitle}>Ai Cavalli • Private Dining</p>
                    </header>

                    <form onSubmit={handleLogin} className={styles.premiumForm}>
                        <div className={styles.inputGroup}>
                            <label>FULL NAME</label>
                            <div className={styles.inputContainer}>
                                <input
                                    type="text"
                                    placeholder="Giacomo Puccini"
                                    required
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                />
                                <UserCircle size={16} className={styles.inputIcon} color={ITALIAN_RED} />
                            </div>
                        </div>

                        <div className={styles.inputGroup}>
                            <label>PHONE NUMBER</label>
                            <div className={styles.inputContainer}>
                                <input
                                    type="tel"
                                    placeholder="000 000 0000"
                                    required
                                    value={phone}
                                    onChange={e => setPhone(e.target.value)}
                                />
                                <Phone size={16} className={styles.inputIcon} color={ITALIAN_RED} />
                            </div>
                        </div>

                        <div className={styles.gridRow}>
                            <div className={styles.inputGroup}>
                                <label>TABLE NO.</label>
                                <div className={styles.inputContainer}>
                                    <input
                                        type="text"
                                        placeholder="A1"
                                        required
                                        value={tableName}
                                        onChange={e => setTableName(e.target.value)}
                                    />
                                    <Hash size={16} className={styles.inputIcon} color={ITALIAN_RED} />
                                </div>
                            </div>
                            <div className={styles.inputGroup}>
                                <label>GUESTS</label>
                                <div className={styles.inputContainer}>
                                    <input
                                        type="number"
                                        min="1"
                                        required
                                        value={numGuests}
                                        onChange={e => setNumGuests(e.target.value)}
                                    />
                                    <Users size={16} className={styles.inputIcon} color={ITALIAN_RED} />
                                </div>
                            </div>
                        </div>

                        <Button
                            type="submit"
                            isLoading={loading}
                            className={styles.actionButton}
                        >
                            ENTER DINING ROOM
                        </Button>

                        <p className={styles.disclaimer}>
                            Authentic Italian Excellence <br />
                            Est. 1994
                        </p>
                    </form>
                </div>
            </div>
        </main>
    )
}