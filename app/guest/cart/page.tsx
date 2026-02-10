'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useCart } from '@/lib/context/CartContext'
import { useAuth } from '@/lib/auth/context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Trash2, ChevronLeft } from 'lucide-react'
import Link from 'next/link'

export default function GuestCartPage() {
    const { items, removeFromCart, updateQuantity, total, clearCart } = useCart()
    const { user } = useAuth()
    const router = useRouter()

    const [loading, setLoading] = useState(false)
    const [tableName, setTableName] = useState('')
    const [numGuests, setNumGuests] = useState('1')
    const [locationType, setLocationType] = useState<'indoor' | 'outdoor'>('indoor')
    const [notes, setNotes] = useState('')

    // Load guest session data on mount
    useEffect(() => {
        // Get session data from localStorage (set during login)
        const sessionData = localStorage.getItem('guest_session')
        if (sessionData) {
            try {
                const session = JSON.parse(sessionData)
                if (session.tableName) setTableName(session.tableName)
                if (session.numGuests) setNumGuests(String(session.numGuests))
            } catch (e) {
                console.error('Failed to parse guest session:', e)
            }
        }

        // Fallback to individual localStorage items
        const savedTable = localStorage.getItem('guest_table')
        const savedLocation = localStorage.getItem('guest_location')
        const savedNumGuests = localStorage.getItem('guest_num_guests')

        if (savedTable && !tableName) setTableName(savedTable)
        if (savedLocation) setLocationType(savedLocation as 'indoor' | 'outdoor')
        if (savedNumGuests && numGuests === '1') setNumGuests(savedNumGuests)
    }, [])

    // State updaters with persistence
    const updateTable = (val: string) => {
        setTableName(val)
        localStorage.setItem('guest_table', val)
    }

    const updateLocation = (val: 'indoor' | 'outdoor') => {
        setLocationType(val)
        localStorage.setItem('guest_location', val)
    }

    const updateNumGuests = (val: string) => {
        setNumGuests(val)
        localStorage.setItem('guest_num_guests', val)
    }

    const handleCheckout = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!user || !tableName) {
            alert('Please ensure you are logged in and have entered a table number')
            return
        }

        setLoading(true)

        try {
            // Get session ID from localStorage
            const sessionData = localStorage.getItem('guest_session')
            let sessionId = null
            if (sessionData) {
                try {
                    const session = JSON.parse(sessionData)
                    sessionId = session.id
                } catch (e) {
                    console.error('Failed to parse session:', e)
                }
            }

            // Prepare order items for API
            const orderItems = items.map(item => ({
                itemId: item.itemId,
                quantity: item.quantity,
                price: item.price
            }))

            // Call the secure order creation API
            const response = await fetch('/api/orders/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // No Bearer token for guests - they use session-based auth
                },
                body: JSON.stringify({
                    userId: user.id,
                    phone: user.phone,
                    items: orderItems,
                    tableName: tableName,
                    numGuests: parseInt(numGuests) || 1,
                    locationType: locationType,
                    notes: notes,
                    sessionId: sessionId
                })
            })

            const data = await response.json()

            if (!data.success) {
                throw new Error(data.error || 'Failed to create order')
            }

            // Save Order ID to local history for persistence
            const existingOrders = JSON.parse(localStorage.getItem('guest_orders') || '[]')
            localStorage.setItem('guest_orders', JSON.stringify([...existingOrders, data.orderId]))

            clearCart()
            router.push(`/guest/status?orderId=${data.orderId}`)
        } catch (err: any) {
            console.error('Order creation error:', err)
            alert(err.message || 'Failed to place order. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    if (items.length === 0) {
        return (
            <div className="container" style={{ paddingTop: '2rem', textAlign: 'center' }}>
                <h1>Checkout</h1>
                <p style={{ margin: '1rem 0' }}>Your cart is empty.</p>
                <Button onClick={() => router.push('/guest/menu')}>Browse Menu</Button>
            </div>
        )
    }

    return (
        <div className="container" style={{ paddingTop: '1.5rem', paddingBottom: '6rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                <Link href="/guest/menu" style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center' }}>
                    <ChevronLeft size={28} />
                </Link>
                <h1 style={{ margin: 0, color: 'var(--primary)', fontFamily: 'var(--font-serif)' }}>Guest Checkout</h1>
            </div>

            {/* Cart Items List */}
            <div style={{ marginBottom: '2rem' }}>
                {items.map(item => (
                    <div key={item.itemId} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: 'var(--surface)',
                        padding: '1rem',
                        marginBottom: '0.5rem',
                        borderRadius: 'var(--radius)',
                        border: '1px solid var(--border)'
                    }}>
                        <div style={{ flex: 1 }}>
                            <h3 style={{ fontSize: '1rem', marginBottom: '0.25rem' }}>{item.name}</h3>
                            <p style={{ color: 'var(--primary)', fontWeight: 'bold' }}>₹{item.price.toFixed(2)}</p>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <button onClick={() => updateQuantity(item.itemId, -1)} style={{ width: '24px', height: '24px', borderRadius: '50%', border: '1px solid #ccc' }}>-</button>
                                <span>{item.quantity}</span>
                                <button onClick={() => updateQuantity(item.itemId, 1)} style={{ width: '24px', height: '24px', borderRadius: '50%', border: '1px solid #ccc' }}>+</button>
                            </div>
                            <button onClick={() => removeFromCart(item.itemId)} style={{ color: 'red', border: 'none', background: 'none' }}>
                                <Trash2 size={18} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            <div style={{
                background: 'var(--surface)',
                padding: '1.5rem',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', fontSize: '1.25rem', fontWeight: 'bold' }}>
                    <span>Total</span>
                    <span>₹{total.toFixed(2)}</span>
                </div>

                <form onSubmit={handleCheckout} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {/* Guest info from login session */}
                    {user && (
                        <div style={{
                            background: 'var(--background)',
                            padding: '0.75rem 1rem',
                            borderRadius: 'var(--radius)',
                            marginBottom: '0.5rem'
                        }}>
                            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                                Ordering as: <strong style={{ color: 'var(--text)' }}>{user.name}</strong>
                            </p>
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: 'var(--space-4)', marginBottom: 'var(--space-2)' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer', fontWeight: 600 }}>
                            <input
                                type="radio"
                                name="locationType"
                                checked={locationType === 'indoor'}
                                onChange={() => updateLocation('indoor')}
                                style={{ accentColor: 'var(--primary)', width: '18px', height: '18px' }}
                            />
                            Indoor
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer', fontWeight: 600 }}>
                            <input
                                type="radio"
                                name="locationType"
                                checked={locationType === 'outdoor'}
                                onChange={() => updateLocation('outdoor')}
                                style={{ accentColor: 'var(--primary)', width: '18px', height: '18px' }}
                            />
                            Outdoor
                        </label>
                    </div>

                    <Input
                        label="Table / Room Number"
                        placeholder="e.g. 5"
                        type="text"
                        required
                        value={tableName}
                        onChange={e => updateTable(e.target.value)}
                    />

                    <Input
                        label="Number of Guests"
                        type="number"
                        min="1"
                        required
                        value={numGuests}
                        onChange={e => updateNumGuests(e.target.value)}
                    />

                    <Input
                        label="Notes (Optional)"
                        placeholder="e.g. No salt..."
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                    />

                    <Button type="submit" isLoading={loading} size="lg" style={{ marginTop: '1rem' }} disabled={!user}>
                        Place Order
                    </Button>
                </form>
            </div>
        </div>
    )
}
