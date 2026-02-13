'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth/context'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/database/supabase'
import { ChevronLeft, User, Package, LogOut, MessageSquare, ShieldCheck, Utensils, Receipt, CreditCard } from 'lucide-react'
import Link from 'next/link'
import { Loading } from '@/components/ui/Loading'
import { useCart } from '@/lib/context/CartContext'

export default function ProfilePage() {
    const { logout, user } = useAuth()
    const role = user?.role
    const { clearCart } = useCart()
    const [userDetails, setUserDetails] = useState<any>(null)
    const [orders, setOrders] = useState<any[]>([])
    const [loadingOrders, setLoadingOrders] = useState(true)
    const [activeSession, setActiveSession] = useState<any>(null)
    const [endingSession, setEndingSession] = useState(false)

    useEffect(() => {
        if (!user) return

        // Set initial user details from context
        setUserDetails(user)

        async function fetchUserDetails() {
            const { data } = await supabase
                .from('users')
                .select('*')
                .eq('id', user!.id)
                .single()
            if (data) setUserDetails(data)
        }

        async function fetchOrders() {
            const { data } = await supabase
                .from('orders')
                .select(`
                    *,
                    items:order_items(
                        id, quantity, price,
                        menu_item:menu_items(name)
                    )
                `)
                .eq('user_id', user!.id)
                .order('created_at', { ascending: false })

            if (data) setOrders(data)
            setLoadingOrders(false)
        }

        async function fetchActiveSession() {
            if (user?.role === 'OUTSIDER') {
                try {
                    // Use phone for session lookup (or userId as fallback)
                    const phone = userDetails?.phone || user?.phone
                    const response = await fetch(`/api/sessions/active?phone=${phone}&userId=${user.id}`)
                    const data = await response.json()
                    if (data.success) setActiveSession(data.session)
                } catch (e) { console.error(e) }
            }
        }

        fetchUserDetails()
        fetchOrders()
        fetchActiveSession()

        const channel = supabase
            .channel(`user-profile-orders-${user.id}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'orders',
                    filter: `user_id=eq.${user.id}`
                },
                (payload) => {
                    fetchOrders()
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [user])

    const handleGetBill = async () => {
        // CASE 1: No active session AND no orders placed
        if (!activeSession && orders.length === 0) {
            const confirmed = confirm(
                "Leaving Ai Cavalli?\n\n" +
                "You haven't placed any orders yet. Would you like to end your visit and sign out?"
            )
            if (confirmed) {
                clearCart()
                logout()
            }
            return
        }

        // CASE 2: No orders to bill
        if (orders.length === 0) {
            alert("You haven't placed any orders yet. Please place an order first.")
            return
        }

        // CASE 3: Active session exists with orders
        const confirmed = confirm(
            "Request your bill?\n\n" +
            "A waiter will bring the bill to your table. You can still add more orders if you change your mind."
        )

        if (!confirmed) return

        setEndingSession(true)
        try {
            const response = await fetch('/api/bills/request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: activeSession.id,
                    userId: user?.id
                })
            })

            const data = await response.json()
            if (data.success) {
                alert(data.message || "Bill request sent! A waiter will bring your bill shortly.")
            } else {
                alert(`Failed to request bill: ${data.error}`)
            }
        } catch (error) {
            console.error(error)
            alert("Failed to request bill. Please ask a waiter directly.")
        } finally {
            setEndingSession(false)
        }
    }

    return (
        <div className="container fade-in" style={{ paddingTop: 'var(--space-6)', paddingBottom: 'var(--space-12)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-8)' }}>
                <Link href="/home" style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center' }}>
                    <ChevronLeft size={32} />
                </Link>
                <h1 style={{ margin: 0, fontSize: '2.5rem', fontFamily: 'var(--font-serif)' }}>My Account</h1>
            </div>

            <div style={{
                background: 'var(--surface)',
                padding: 'var(--space-6)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border)',
                boxShadow: 'var(--shadow-md)',
                marginBottom: 'var(--space-8)',
                position: 'relative',
                overflow: 'hidden'
            }}>
                <div style={{
                    position: 'absolute',
                    top: '-20px',
                    right: '-20px',
                    width: '100px',
                    height: '100px',
                    background: 'rgba(var(--primary-rgb), 0.03)',
                    borderRadius: '50%'
                }} />

                {user ? (
                    <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>
                            <div style={{
                                width: '64px',
                                height: '64px',
                                borderRadius: 'var(--radius)',
                                background: 'rgba(var(--primary-rgb), 0.1)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'var(--primary)'
                            }}>
                                <User size={32} strokeWidth={1.5} />
                            </div>
                            <div>
                                <h2 style={{ fontSize: '1.5rem', margin: 0 }}>{userDetails?.name || 'Ai Cavalli Member'}</h2>
                                <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.875rem' }}>{role === 'STUDENT' ? 'RIDER' : role} ACCOUNT</p>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-6)', marginBottom: 'var(--space-8)' }}>
                            <div style={{ padding: 'var(--space-4)', background: 'var(--background)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>
                                    {role === 'STUDENT' ? 'PHONE NUMBER' : 'EMAIL ADDRESS'}
                                </p>
                                <p style={{ fontWeight: 700, margin: 0 }}>
                                    {role === 'STUDENT'
                                        ? (userDetails?.phone || 'Not set')
                                        : (userDetails?.email || 'Not set')}
                                </p>
                            </div>
                            <div style={{ padding: 'var(--space-4)', background: 'var(--background)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>SECURITY PIN</p>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <ShieldCheck size={16} color="#10B981" />
                                    <p style={{ fontWeight: 700, margin: 0 }}>Verified</p>
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
                            {role === 'OUTSIDER' && (
                                <div style={{
                                    flex: '1 1 100%',
                                    background: 'rgba(16, 185, 129, 0.05)',
                                    padding: 'var(--space-4)',
                                    borderRadius: 'var(--radius)',
                                    border: '1px solid rgba(16, 185, 129, 0.2)',
                                    marginBottom: 'var(--space-2)'
                                }}>
                                    {/* Order Summary */}
                                    {activeSession && (
                                        <div style={{
                                            background: 'var(--background)',
                                            padding: 'var(--space-4)',
                                            borderRadius: 'var(--radius-sm)',
                                            marginBottom: 'var(--space-4)',
                                            border: '1px solid var(--border)'
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>SESSION SUMMARY</span>
                                                <span style={{ fontSize: '0.75rem', background: '#10B981', color: 'white', padding: '2px 8px', borderRadius: '4px' }}>ACTIVE</span>
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                                <div>
                                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0 0 4px 0' }}>TABLE</p>
                                                    <p style={{ fontWeight: 700, margin: 0, fontSize: '1.1rem' }}>{activeSession.table_name}</p>
                                                </div>
                                                <div>
                                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0 0 4px 0' }}>ORDERS</p>
                                                    <p style={{ fontWeight: 700, margin: 0, fontSize: '1.1rem' }}>{orders.length} placed</p>
                                                </div>
                                            </div>
                                            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Current Total</span>
                                                    <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)' }}>
                                                        ₹{(activeSession.total_amount || orders.reduce((sum: number, o: any) => sum + (o.total || 0), 0)).toFixed(2)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Action Buttons */}
                                    <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                                        <Button
                                            onClick={() => window.location.href = '/home'}
                                            variant="outline"
                                            style={{
                                                flex: 1,
                                                height: '48px',
                                                fontSize: '1rem',
                                                fontWeight: 700,
                                                borderColor: 'var(--primary)',
                                                color: 'var(--primary)'
                                            }}
                                        >
                                            <Utensils size={18} style={{ marginRight: '8px' }} />
                                            ORDER MORE
                                        </Button>
                                    </div>

                                    <Button
                                        onClick={handleGetBill}
                                        disabled={endingSession || orders.length === 0}
                                        style={{
                                            width: '100%',
                                            height: '56px',
                                            fontSize: '1.25rem',
                                            fontWeight: 900,
                                            background: orders.length === 0 ? '#ccc' : 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                                            border: 'none',
                                            boxShadow: orders.length === 0 ? 'none' : '0 4px 12px rgba(16, 185, 129, 0.3)',
                                            color: 'white',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '12px',
                                            cursor: orders.length === 0 ? 'not-allowed' : 'pointer'
                                        }}
                                    >
                                        <Receipt size={24} />
                                        {endingSession ? 'Requesting...' : orders.length === 0 ? 'NO ORDERS YET' : 'GET THE BILL'}
                                    </Button>

                                    {orders.length > 0 && (
                                        <p style={{
                                            margin: '10px 0 0 0',
                                            fontSize: '0.8rem',
                                            color: '#059669',
                                            textAlign: 'center'
                                        }}>
                                            A waiter will bring your bill to the table
                                        </p>
                                    )}
                                </div>
                            )}
                            <Button
                                onClick={() => window.open('https://wa.me/1234567890', '_blank')}
                                variant="outline"
                                style={{ flex: 1, minWidth: '180px', color: '#075E54', borderColor: '#075E54' }}
                            >
                                <MessageSquare size={18} style={{ marginRight: '8px' }} />
                                Contact Support
                            </Button>
                            <Button onClick={() => { clearCart(); logout(); }} variant="outline" style={{ flex: 1, minWidth: '180px' }}>
                                <LogOut size={18} style={{ marginRight: '8px' }} />
                                Sign Out
                            </Button>
                        </div>
                    </>
                ) : (
                    <div style={{ textAlign: 'center', padding: 'var(--space-4) 0' }}>
                        <div style={{
                            width: '80px',
                            height: '80px',
                            borderRadius: '50%',
                            background: 'rgba(var(--secondary-rgb), 0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--secondary)',
                            margin: '0 auto var(--space-4)'
                        }}>
                            <User size={40} />
                        </div>
                        <h2 style={{ fontSize: '1.75rem', marginBottom: 'var(--space-2)' }}>Guest Seeker</h2>
                        <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--space-6)', maxWidth: '400px', margin: '0 auto var(--space-6)' }}>
                            Sign in to save your favorite dishes and view your full order history.
                        </p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', maxWidth: '500px', margin: '0 auto' }}>
                            <Link href="/login" style={{ flex: 1, minWidth: '200px' }}>
                                <Button style={{ width: '100%', height: '48px' }}>Sign In / Register</Button>
                            </Link>
                            <Button
                                onClick={() => window.open('https://wa.me/1234567890', '_blank')}
                                variant="outline"
                                style={{ flex: 1, minWidth: '200px', height: '48px' }}
                            >
                                Contact Support
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
                <Package size={24} color="var(--primary)" />
                <h2 style={{ margin: 0, fontSize: '1.5rem', fontFamily: 'var(--font-serif)' }}>Order History</h2>
            </div>

            {!user ? (
                <div style={{ textAlign: 'center', padding: 'var(--space-8)', border: '2px dashed var(--border)', borderRadius: 'var(--radius-lg)' }}>
                    <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', margin: 0 }}>Please sign in to view your previous orders.</p>
                </div>
            ) : loadingOrders ? (
                <div style={{ padding: 'var(--space-8)' }}><Loading /></div>
            ) : orders.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    {orders.map(order => {
                        const statusColors: any = {
                            pending: { bg: '#FFF7ED', text: '#9A3412', border: '#FFEDD5' },
                            ready: { bg: '#ECFDF5', text: '#065F46', border: '#D1FAE5' },
                            completed: { bg: '#F3F4F6', text: '#374151', border: '#E5E7EB' },
                            cancelled: { bg: '#FEF2F2', text: '#991B1B', border: '#FEE2E2' }
                        }
                        const colors = statusColors[order.status] || statusColors.pending

                        return (
                            <div key={order.id} className="hover-lift" style={{
                                background: 'var(--surface)',
                                padding: 'var(--space-4)',
                                borderRadius: 'var(--radius)',
                                border: '1px solid var(--border)',
                                boxShadow: 'var(--shadow-sm)'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-3)' }}>
                                    <div>
                                        <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', margin: 0, letterSpacing: '0.05em' }}>ORDER ID</p>
                                        <span style={{ fontWeight: 800, fontSize: '1.125rem' }}>#{order.id.slice(0, 8).toUpperCase()}</span>
                                    </div>
                                    <span style={{
                                        background: colors.bg,
                                        color: colors.text,
                                        border: `1px solid ${colors.border}`,
                                        padding: '4px 12px',
                                        borderRadius: 'var(--radius-sm)',
                                        fontSize: '0.75rem',
                                        fontWeight: 800,
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.05em'
                                    }}>{order.status}</span>
                                </div>

                                <div style={{ marginBottom: 'var(--space-3)' }}>
                                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                                        {order.notes === 'REGULAR_STAFF_MEAL' ? (
                                            <li style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 600 }}>
                                                <Utensils size={14} />
                                                <span>Standard Regular Staff Meal</span>
                                            </li>
                                        ) : (
                                            order.items?.map((item: any) => (
                                                <li key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#444', marginBottom: '2px' }}>
                                                    <span>{item.quantity}x {item.menu_item?.name}</span>
                                                    <span style={{ color: 'var(--text-muted)' }}>₹{(item.quantity * item.price).toFixed(2)}</span>
                                                </li>
                                            ))
                                        )}
                                    </ul>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--border)' }}>
                                    <div>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                                            {new Date(order.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                        </p>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                            {order.discount_amount > 0 && (
                                                <div style={{ fontSize: '0.75rem', color: '#DC2626', fontWeight: 600 }}>
                                                    Discount: -{order.discount_amount}%
                                                </div>
                                            )}
                                            <span style={{ fontWeight: 800, fontSize: '1.25rem', color: 'var(--primary)' }}>
                                                ₹{order.total.toFixed(2)}
                                            </span>
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '2px' }}>LOCATION</p>
                                        <span style={{ fontWeight: 600, background: 'var(--background)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.875rem' }}>
                                            {order.table_name}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            ) : (
                <div style={{ textAlign: 'center', padding: 'var(--space-8)', border: '2px dashed var(--border)', borderRadius: 'var(--radius-lg)' }}>
                    <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', margin: 0 }}>No orders placed yet. Time to eat!</p>
                </div>
            )}
        </div>
    )
}


