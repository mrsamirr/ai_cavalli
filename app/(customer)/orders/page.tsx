'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/database/supabase'
import { useAuth } from '@/lib/auth/context'

import { useSearchParams } from 'next/navigation'
import { ChevronLeft, Package, Clock, CheckCircle2, XCircle } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Loading } from '@/components/ui/Loading'
import { Utensils, Receipt } from 'lucide-react'
import { useCart } from '@/lib/context/CartContext'
import { BillPreviewModal, BillData } from '@/components/ui/BillPreviewModal'

export default function OrdersPage() {
    const { user, logout } = useAuth()
    const { clearCart } = useCart()
    const searchParams = useSearchParams()
    const orderIdParam = searchParams.get('orderId')

    const [orders, setOrders] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [activeSession, setActiveSession] = useState<any>(null)
    const [endingSession, setEndingSession] = useState(false)
    const [billPreview, setBillPreview] = useState<BillData | null>(null)

    useEffect(() => {
        // If neither user nor orderIdParam, we can't show anything
        if (!user && !orderIdParam) {
            setLoading(false)
            return
        }

        async function fetchOrders() {
            let query = supabase.from('orders').select(`
                *,
                items:order_items(
                    id, quantity, price,
                    menu_item:menu_items(name)
                )
            `)

            if (user) {
                query = query.eq('user_id', user.id)
            } else if (orderIdParam) {
                query = query.eq('id', orderIdParam)
            }

            const { data } = await query.order('created_at', { ascending: false })

            if (data) setOrders(data)
            setLoading(false)
        }

        async function fetchActiveSession() {
            try {
                if (user?.role === 'OUTSIDER') {
                    // OUTSIDER: look up guest_session by phone or userId
                    const params = new URLSearchParams()
                    if (user.phone) params.set('phone', user.phone)
                    params.set('userId', user.id)

                    const response = await fetch(`/api/sessions/active?${params.toString()}`)
                    const data = await response.json()
                    if (data.success && data.session) {
                        setActiveSession(data.session)
                        return
                    }
                }
                // For ALL roles (including OUTSIDER fallback): build a virtual session from orders
                // This ensures STUDENT/STAFF can also use "Get the Bill"
                // We'll set a marker so handleGetBill knows to use the user-based flow
                if (user) {
                    setActiveSession({ _virtual: true, userId: user.id })
                }
            } catch (e) {
                console.error('fetchActiveSession error:', e)
                // Still set virtual session so the bill button works
                if (user) {
                    setActiveSession({ _virtual: true, userId: user.id })
                }
            }
        }

        fetchOrders()
        fetchActiveSession()

        // Real-time listener
        const filter = user ? `user_id=eq.${user.id}` : (orderIdParam ? `id=eq.${orderIdParam}` : '')
        if (!filter) return

        const channel = supabase
            .channel(`orders-tracking-${user?.id || orderIdParam}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'orders',
                    filter: filter
                },
                (payload) => {
                    fetchOrders()
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [user, orderIdParam])

    const handleGetBill = async () => {
        // CASE 1: No orders placed at all
        if (orders.length === 0) {
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

        // CASE 2: Has orders — confirm bill generation
        const confirmed = confirm(
            "Request your bill?\n\n" +
            "This will generate your bill. You can print or save it as PDF."
        )

        if (!confirmed) return

        setEndingSession(true)
        try {
            let data: any

            // Use session-based flow for OUTSIDER with a real guest_session
            if (activeSession && !activeSession._virtual && activeSession.id) {
                const response = await fetch('/api/bills/session', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        sessionId: activeSession.id,
                        paymentMethod: 'cash'
                    })
                })
                data = await response.json()
            } else {
                // User-based flow for STUDENT/STAFF or OUTSIDER without session
                const response = await fetch('/api/bills/user', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId: user?.id,
                        paymentMethod: 'cash'
                    })
                })
                data = await response.json()
            }

            if (data.success && data.bill) {
                // Show the bill preview modal
                setBillPreview({
                    id: data.bill.id,
                    billNumber: data.bill.billNumber,
                    items: data.bill.items || [],
                    itemsTotal: data.bill.itemsTotal,
                    discountAmount: data.bill.discountAmount,
                    finalTotal: data.bill.finalTotal,
                    paymentMethod: data.bill.paymentMethod,
                    createdAt: new Date().toISOString(),
                    sessionDetails: data.bill.sessionDetails
                })
            } else {
                alert(`Failed to generate bill: ${data.error || 'Unknown error'}`)
            }
        } catch (error) {
            console.error(error)
            alert("Failed to generate bill. Please ask a waiter directly.")
        } finally {
            setEndingSession(false)
        }
    }

    if (loading) {
        return <Loading fullScreen message="Fetching your order status..." />
    }

    const handleBillPreviewClose = () => {
        setBillPreview(null)
    }

    const handlePrintComplete = () => {
        setBillPreview(null)
        // Optionally refresh session data
        setActiveSession(null)
    }

    return (
        <div className="container fade-in" style={{ paddingTop: 'var(--space-6)', paddingBottom: 'var(--space-12)' }}>
            {/* Bill Preview Modal */}
            {billPreview && (
                <BillPreviewModal
                    bill={billPreview}
                    onClose={handleBillPreviewClose}
                    onPrintComplete={handlePrintComplete}
                />
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-8)' }}>
                <Link href={user ? "/home" : "/menu"} style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center' }}>
                    <ChevronLeft size={32} />
                </Link>
                <h1 style={{ margin: 0, fontSize: '2.5rem', fontFamily: 'var(--font-serif)' }}>
                    {orderIdParam && !user ? 'Order Status' : 'My Orders'}
                </h1>
            </div>

            {user && (
                <div style={{
                    marginBottom: 'var(--space-6)',
                    background: orders.length > 0 ? 'linear-gradient(135deg, #10B981 0%, #059669 100%)' : 'rgba(255, 255, 255, 0.9)',
                    borderRadius: 'var(--radius-lg)',
                    padding: 'var(--space-5)',
                    color: orders.length > 0 ? 'white' : 'var(--text)',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
                    border: orders.length > 0 ? 'none' : '2px dashed #10B981',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--space-4)'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>
                                {orders.length > 0 ? 'Finalize Your Meal' : 'Ready for the Bill?'}
                            </h3>
                            {orders.length > 0 ? (
                                <p style={{ margin: 0, opacity: 0.9, fontSize: '0.875rem' }}>
                                    {orders.length} Order{orders.length !== 1 ? 's' : ''} placed
                                </p>
                            ) : (
                                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                                    Place an order first, then get your bill here
                                </p>
                            )}
                        </div>
                        <Receipt size={32} color={orders.length > 0 ? 'white' : '#10B981'} />
                    </div>
                    <Button
                        onClick={handleGetBill}
                        disabled={endingSession}
                        style={{
                            background: orders.length > 0 ? 'white' : 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                            color: orders.length > 0 ? '#059669' : 'white',
                            fontWeight: 900,
                            height: '56px',
                            border: 'none',
                            fontSize: '1.125rem',
                            boxShadow: orders.length > 0 ? 'none' : '0 4px 12px rgba(16, 185, 129, 0.3)'
                        }}
                    >
                        {endingSession ? 'Processing...' : 'GET THE BILL'}
                    </Button>
                    <p style={{
                        margin: 0,
                        fontSize: '0.75rem',
                        textAlign: 'center',
                        opacity: orders.length > 0 ? 0.9 : 0.7,
                        fontStyle: 'italic'
                    }}>
                        {orders.length > 0
                            ? "Generate your bill and print or save as PDF."
                            : "Note: You must have placed at least one order to generate a bill."}
                    </p>
                </div>
            )}

            {orders.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
                    {orders.map(order => {
                        const statusConfig: any = {
                            pending: { icon: Clock, color: '#F59E0B', label: 'Preparing', bg: 'rgba(245, 158, 11, 0.1)' },
                            ready: { icon: CheckCircle2, color: 'var(--primary)', label: 'Ready for Pickup', bg: 'rgba(var(--primary-rgb), 0.1)' },
                            completed: { icon: CheckCircle2, color: '#10B981', label: 'Completed', bg: 'rgba(16, 185, 129, 0.1)' },
                            cancelled: { icon: XCircle, color: '#EF4444', label: 'Cancelled', bg: 'rgba(239, 68, 68, 0.1)' }
                        }
                        const config = statusConfig[order.status] || statusConfig.pending
                        const StatusIcon = config.icon

                        return (
                            <div key={order.id} className="hover-lift" style={{
                                background: 'var(--surface)',
                                borderRadius: 'var(--radius-lg)',
                                border: '1px solid var(--border)',
                                boxShadow: 'var(--shadow-md)',
                                overflow: 'hidden'
                            }}>
                                <div style={{
                                    background: config.bg,
                                    padding: 'var(--space-4) var(--space-6)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    borderBottom: '1px solid var(--border)'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                                        <StatusIcon size={24} color={config.color} />
                                        <span style={{ fontWeight: 800, color: config.color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                            {config.label}
                                        </span>
                                    </div>
                                    <span style={{ fontSize: '0.875rem', fontWeight: 600, opacity: 0.7 }}>
                                        #{order.id.slice(0, 8).toUpperCase()}
                                    </span>
                                </div>

                                <div style={{ padding: 'var(--space-6)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
                                        <div>
                                            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>Placed At</p>
                                            <p style={{ margin: 0, fontWeight: 700 }}>{new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                        </div>
                                        <div style={{ textAlign: 'center' }}>
                                            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>Guests</p>
                                            <p style={{ margin: 0, fontWeight: 700 }}>{order.num_guests || 1}</p>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>Location</p>
                                            <p style={{ margin: 0, fontWeight: 700 }}>{order.table_name}</p>
                                        </div>
                                    </div>

                                    <div style={{
                                        padding: 'var(--space-4)',
                                        background: 'var(--background)',
                                        borderRadius: 'var(--radius)',
                                        border: '1px solid var(--border)',
                                        marginBottom: 'var(--space-4)'
                                    }}>
                                        <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 'var(--space-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Order Summary</p>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                                            {order.notes === 'REGULAR_STAFF_MEAL' ? (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--primary)', fontWeight: 600 }}>
                                                    <Utensils size={16} />
                                                    <span>Standard Regular Staff Meal</span>
                                                </div>
                                            ) : (
                                                order.items?.map((item: any) => (
                                                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', fontWeight: 600 }}>
                                                        <span style={{ color: 'var(--text)' }}>{item.quantity}x {item.menu_item?.name}</span>
                                                        <span style={{ color: 'var(--text-muted)' }}>₹{(item.quantity * item.price).toFixed(2)}</span>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>

                                    <div style={{
                                        padding: 'var(--space-4)',
                                        background: 'rgba(var(--primary-rgb), 0.05)',
                                        borderRadius: 'var(--radius)',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                                            <Package size={20} color="var(--primary)" />
                                            <span style={{ fontWeight: 700 }}>Total Amount</span>
                                        </div>
                                        <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary)' }}>₹{order.total.toFixed(2)}</span>
                                    </div>

                                    {order.notes && (
                                        <div style={{ marginTop: 'var(--space-4)', padding: 'var(--space-3)', background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem' }}>
                                            <span style={{ fontWeight: 700, marginRight: '8px' }}>Notes:</span>
                                            <span style={{ color: 'var(--text-muted)' }}>{order.notes}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            ) : (
                <div style={{ textAlign: 'center', padding: 'var(--space-12) var(--space-6)', background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
                    <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'var(--background)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto var(--space-4)', color: 'var(--text-muted)' }}>
                        <Clock size={40} />
                    </div>
                    <h2 style={{ fontSize: '1.5rem', marginBottom: 'var(--space-2)' }}>No Orders Found</h2>
                    <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--space-6)' }}>
                        We couldn't find any active or past orders for you.
                    </p>
                    <Link href="/menu">
                        <Button>Go to Menu</Button>
                    </Link>
                </div>
            )}
        </div>
    )
}
