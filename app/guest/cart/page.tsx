'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useCart } from '@/lib/context/CartContext'
import { supabase } from '@/lib/database/supabase'
import { sanitizePhone } from '@/lib/utils/phone'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Trash2, ChevronLeft } from 'lucide-react'
import Link from 'next/link'

export default function GuestCartPage() {
    const { items, removeFromCart, updateQuantity, total, clearCart } = useCart()
    const router = useRouter()

    const [loading, setLoading] = useState(false)
    const [name, setName] = useState('')
    const [phone, setPhone] = useState('')
    const [tableName, setTableName] = useState('')
    const [numGuests, setNumGuests] = useState('1')
    const [locationType, setLocationType] = useState<'indoor' | 'outdoor'>('indoor')
    const [notes, setNotes] = useState('')

    // Persistence: Load from localStorage on mount
    useEffect(() => {
        const savedName = localStorage.getItem('guest_name')
        const savedPhone = localStorage.getItem('guest_phone')
        const savedTable = localStorage.getItem('guest_table')
        const savedLocation = localStorage.getItem('guest_location')
        const savedNumGuests = localStorage.getItem('guest_num_guests')

        if (savedName) setName(savedName)
        if (savedPhone) setPhone(savedPhone)
        if (savedTable) setTableName(savedTable)
        if (savedLocation) setLocationType(savedLocation as 'indoor' | 'outdoor')
        if (savedNumGuests) setNumGuests(savedNumGuests)
    }, [])

    // State updaters with persistence
    const updateName = (val: string) => {
        setName(val)
        localStorage.setItem('guest_name', val)
    }

    const updatePhone = (val: string) => {
        const numeric = val.replace(/\D/g, '')
        const sanitized = numeric.startsWith('0') ? numeric.slice(1) : numeric
        const truncated = sanitized.slice(0, 10)

        setPhone(truncated)
        localStorage.setItem('guest_phone', truncated)
    }

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
        if (!name || !phone || !tableName) return

        const finalPhone = sanitizePhone(phone)

        if (finalPhone.length < 10) {
            alert('Please enter a valid 10-digit phone number')
            return
        }

        setLoading(true)

        try {
            const guestInfo = { name: name.trim(), phone: finalPhone }

            // Create Order
            const { data: order, error: orderError } = await supabase
                .from('orders')
                .insert({
                    user_id: null, // Guest
                    guest_info: guestInfo,
                    table_name: tableName,
                    location_type: locationType,
                    num_guests: parseInt(numGuests) || 1,
                    status: 'pending',
                    total: total,
                    notes: notes
                })
                .select()
                .single()

            if (orderError) throw orderError

            // Create Order Items
            const orderItems = items.map(item => ({
                order_id: order.id,
                menu_item_id: item.itemId,
                quantity: item.quantity,
                price: item.price
            }))

            const { error: itemsError } = await supabase
                .from('order_items')
                .insert(orderItems)

            if (itemsError) throw itemsError

            // Save Order ID to local history for persistence
            const existingOrders = JSON.parse(localStorage.getItem('guest_orders') || '[]')
            localStorage.setItem('guest_orders', JSON.stringify([...existingOrders, order.id]))

            clearCart()
            router.push(`/guest/status?orderId=${order.id}`)
        } catch (err) {
            console.error(err)
            alert('Failed to place order')
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
                    <Input
                        label="Full Name"
                        placeholder="John Doe"
                        required
                        value={name}
                        onChange={e => updateName(e.target.value)}
                    />
                    <Input
                        label="Phone Number"
                        placeholder="1234567890"
                        required
                        type="tel"
                        value={phone}
                        onChange={e => updatePhone(e.target.value)}
                    />
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
                        type="number"
                        pattern="[0-9]*"
                        inputMode="numeric"
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

                    <Button type="submit" isLoading={loading} size="lg" style={{ marginTop: '1rem' }}>
                        Place Order
                    </Button>
                </form>
            </div>
        </div>
    )
}
