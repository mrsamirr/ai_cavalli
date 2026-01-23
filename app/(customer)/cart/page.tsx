'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useCart } from '@/lib/context/CartContext'
import { useAuth } from '@/lib/auth/context'
import { supabase } from '@/lib/database/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Trash2, ChevronLeft, ShoppingBag } from 'lucide-react'
import Link from 'next/link'
import { Loading } from '@/components/ui/Loading'

export default function CartPage() {
    const { items, removeFromCart, updateQuantity, total, clearCart } = useCart()
    const { user } = useAuth()
    const router = useRouter()

    const [loading, setLoading] = useState(false)
    const [name, setName] = useState('')
    const [phone, setPhone] = useState('')
    const [tableName, setTableName] = useState('')
    const [numGuests, setNumGuests] = useState('1')
    const [locationType, setLocationType] = useState<'indoor' | 'outdoor'>('indoor')
    const [notes, setNotes] = useState('')

    // Load guest info from localStorage on mount
    useEffect(() => {
        if (!user) {
            const savedName = localStorage.getItem('guest_name')
            const savedPhone = localStorage.getItem('guest_phone')
            if (savedName) setName(savedName)
            if (savedPhone) setPhone(savedPhone)
        }
    }, [user])

    // Save guest info to localStorage when changed
    const handleNameChange = (val: string) => {
        setName(val)
        if (!user) localStorage.setItem('guest_name', val)
    }

    const handlePhoneChange = (val: string) => {
        // Numeric only and max 10 digits
        const numeric = val.replace(/\D/g, '')
        const sanitized = numeric.startsWith('0') ? numeric.slice(1) : numeric
        const truncated = sanitized.slice(0, 10)

        setPhone(truncated)
        if (!user) localStorage.setItem('guest_phone', truncated)
    }

    const handleCheckout = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!tableName) return
        if (!user && (!name || !phone)) {
            alert('Please provide your name and phone number')
            return
        }
        setLoading(true)

        try {
            const guestInfo = !user ? { name, phone } : null

            // Check if cart contains the virtual regular meal item
            const hasRegularMeal = items.some(item => item.itemId === 'REGULAR_MEAL_VIRTUAL')
            const finalNotes = hasRegularMeal ? 'REGULAR_STAFF_MEAL' : notes

            // Create Order
            const { data: order, error: orderError } = await supabase
                .from('orders')
                .insert({
                    user_id: user?.id || null,
                    guest_info: guestInfo,
                    table_name: tableName,
                    location_type: locationType,
                    num_guests: parseInt(numGuests) || 1,
                    status: 'pending',
                    total: total,
                    notes: finalNotes
                })
                .select()
                .single()

            if (orderError) throw orderError

            // Create Order Items (filter out virtual regular meal item)
            const orderItems = items
                .filter(item => item.itemId !== 'REGULAR_MEAL_VIRTUAL')
                .map(item => ({
                    order_id: order.id,
                    menu_item_id: item.itemId,
                    quantity: item.quantity,
                    price: item.price
                }))

            // Only insert order items if there are any (regular meal might be the only item)
            if (orderItems.length > 0) {
                const { error: itemsError } = await supabase
                    .from('order_items')
                    .insert(orderItems)

                if (itemsError) throw itemsError
            }

            clearCart()
            if (!user) {
                router.push(`/orders?orderId=${order.id}`)
            } else {
                router.push('/orders')
            }
        } catch (err: any) {
            console.error('Order placement error:', err)
            alert(`Failed to place order: ${err.message || 'Unknown error'}`)
        } finally {
            setLoading(false)
        }
    }

    if (loading) {
        return <Loading fullScreen message="Placing your order..." />
    }

    if (items.length === 0) {
        return (
            <div className="container fade-in" style={{
                paddingTop: '20vh',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 'var(--space-6)'
            }}>
                <div style={{
                    width: '100px',
                    height: '100px',
                    borderRadius: '50%',
                    background: 'rgba(var(--primary-rgb), 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--primary)',
                    marginBottom: 'var(--space-2)'
                }}>
                    <ShoppingBag size={48} />
                </div>
                <h1 style={{ fontSize: '2rem' }}>Your Cart is Empty</h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '1.125rem', maxWidth: '300px' }}>
                    Looks like you haven't added anything to your cart yet.
                </p>
                <Link href="/menu">
                    <Button size="lg">Discover Our Menu</Button>
                </Link>
            </div>
        )
    }

    return (
        <div className="container fade-in" style={{ paddingTop: 'var(--space-6)', paddingBottom: 'var(--space-12)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-8)' }}>
                <Link href="/menu" style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center' }}>
                    <ChevronLeft size={32} />
                </Link>
                <h1 style={{ margin: 0, fontSize: '2.5rem', fontFamily: 'var(--font-serif)' }}>Checkout</h1>
            </div>

            <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr',
                gap: 'var(--space-8)',
                alignItems: 'start'
            }}>
                {/* Desktop layout: Side by side if possible */}
                <style jsx>{`
                    @media (min-width: 1024px) {
                        div[data-checkout-container] {
                            grid-template-columns: 1fr 400px !important;
                        }
                    }
                `}</style>

                <div data-checkout-container style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 'var(--space-8)' }}>
                    <div>
                        <h2 style={{ marginBottom: 'var(--space-4)', fontSize: '1.25rem', opacity: 0.8 }}>Your Items</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                            {items.map(item => (
                                <div key={item.itemId} className="hover-lift" style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    background: 'var(--surface)',
                                    padding: 'var(--space-4)',
                                    borderRadius: 'var(--radius)',
                                    border: '1px solid var(--border)',
                                    boxShadow: 'var(--shadow-sm)'
                                }}>
                                    <div style={{ flex: 1 }}>
                                        <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '2px' }}>{item.name}</h3>
                                        <p style={{ color: 'var(--primary)', fontWeight: 700 }}>₹{(item.price * item.quantity).toFixed(2)}</p>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            background: 'var(--background)',
                                            borderRadius: 'var(--radius-sm)',
                                            padding: '2px',
                                            border: '1px solid var(--border)'
                                        }}>
                                            <button
                                                onClick={() => updateQuantity(item.itemId, -1)}
                                                style={{
                                                    width: '32px',
                                                    height: '32px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    borderRadius: 'var(--radius-sm)',
                                                    border: 'none',
                                                    background: 'transparent',
                                                    cursor: 'pointer',
                                                    fontSize: '1.25rem'
                                                }}
                                            >-</button>
                                            <span style={{ minWidth: '32px', textAlign: 'center', fontWeight: 700 }}>{item.quantity}</span>
                                            <button
                                                onClick={() => updateQuantity(item.itemId, 1)}
                                                style={{
                                                    width: '32px',
                                                    height: '32px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    borderRadius: 'var(--radius-sm)',
                                                    border: 'none',
                                                    background: 'transparent',
                                                    cursor: 'pointer',
                                                    fontSize: '1.25rem'
                                                }}
                                            >+</button>
                                        </div>
                                        <button
                                            onClick={() => removeFromCart(item.itemId)}
                                            style={{
                                                color: '#EF4444',
                                                border: 'none',
                                                background: 'rgba(239, 68, 68, 0.1)',
                                                width: '36px',
                                                height: '36px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                borderRadius: '50%',
                                                cursor: 'pointer',
                                                transition: 'var(--transition)'
                                            }}
                                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'}
                                            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                                        >
                                            <Trash2 size={20} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div style={{
                        background: 'var(--surface)',
                        padding: 'var(--space-6)',
                        borderRadius: 'var(--radius-lg)',
                        border: '1px solid var(--border)',
                        boxShadow: 'var(--shadow-lg)',
                        position: 'sticky',
                        top: 'var(--space-6)'
                    }}>
                        <h2 style={{ marginBottom: 'var(--space-6)', fontSize: '1.5rem', fontFamily: 'var(--font-serif)' }}>Order Summary</h2>

                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-6)', padding: 'var(--space-4)', background: 'var(--background)', borderRadius: 'var(--radius)' }}>
                            <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Total Amount</span>
                            <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)' }}>₹{total.toFixed(2)}</span>
                        </div>

                        <form onSubmit={handleCheckout} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                            {!user && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', padding: 'var(--space-4)', background: 'rgba(var(--secondary-rgb), 0.05)', borderRadius: 'var(--radius)', border: '1px dashed var(--secondary)' }}>
                                    <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--secondary)', marginBottom: '-0.5rem' }}>GUEST DETAILS</p>
                                    <Input
                                        label="Full Name"
                                        placeholder="Your name"
                                        required
                                        value={name}
                                        onChange={e => handleNameChange(e.target.value)}
                                    />
                                    <Input
                                        label="Phone Number"
                                        placeholder="For order updates"
                                        type="tel"
                                        required
                                        value={phone}
                                        onChange={e => handlePhoneChange(e.target.value)}
                                        maxLength={10}
                                    />
                                </div>
                            )}
                            <div style={{ display: 'flex', gap: 'var(--space-4)', marginBottom: 'var(--space-2)' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer', fontWeight: 600 }}>
                                    <input
                                        type="radio"
                                        name="locationType"
                                        checked={locationType === 'indoor'}
                                        onChange={() => setLocationType('indoor')}
                                        style={{ accentColor: 'var(--primary)', width: '18px', height: '18px' }}
                                    />
                                    Indoor
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer', fontWeight: 600 }}>
                                    <input
                                        type="radio"
                                        name="locationType"
                                        checked={locationType === 'outdoor'}
                                        onChange={() => setLocationType('outdoor')}
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
                                onChange={e => setTableName(e.target.value)}
                            />

                            <Input
                                label="Number of Guests"
                                type="number"
                                min="1"
                                required
                                value={numGuests}
                                onChange={e => setNumGuests(e.target.value)}
                            />

                            <Input
                                label="Special Notes"
                                placeholder="Any allergies or extra requests?"
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                            />

                            {user && (
                                <div style={{
                                    padding: '1.25rem',
                                    background: 'rgba(var(--primary-rgb), 0.05)',
                                    borderRadius: '16px',
                                    border: '1px solid rgba(var(--primary-rgb), 0.15)',
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: '14px',
                                    marginTop: 'var(--space-2)'
                                }}>
                                    <div style={{
                                        minWidth: '28px',
                                        height: '28px',
                                        borderRadius: '50%',
                                        background: 'var(--primary)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: 'white',
                                        fontSize: '0.85rem',
                                        fontWeight: '900',
                                        boxShadow: '0 2px 8px rgba(var(--primary-rgb), 0.3)'
                                    }}>!</div>
                                    <p style={{
                                        margin: 0,
                                        fontSize: '0.9rem',
                                        color: 'var(--text)',
                                        fontWeight: '600',
                                        lineHeight: 1.5
                                    }}>
                                        This transaction will be recorded and settled as part of your <span style={{ color: 'var(--primary)' }}>monthly expense account</span>.
                                    </p>
                                </div>
                            )}

                            <Button type="submit" isLoading={loading} size="lg" style={{ marginTop: 'var(--space-4)', height: '56px', fontSize: '1.125rem' }}>
                                Confirm Order
                            </Button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    )
}
