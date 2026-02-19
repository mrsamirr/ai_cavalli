'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/database/supabase'
import { useAuth } from '@/lib/auth/context'

import { useSearchParams } from 'next/navigation'
import { ChevronLeft, Package, Clock, CheckCircle2, XCircle, ChevronDown } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Loading } from '@/components/ui/Loading'
import { Utensils, Receipt } from 'lucide-react'
import { useCart } from '@/lib/context/CartContext'
import { BillPreviewModal, BillData } from '@/components/ui/BillPreviewModal'
import { showError, showSuccess, showConfirm } from '@/components/ui/Popup'

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
    const [expandedOrder, setExpandedOrder] = useState<string | null>(null)

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
            const confirmed = await showConfirm(
                "Leaving Ai Cavalli?",
                "You haven't placed any orders yet. Would you like to end your visit and sign out?",
                "Sign Out",
                "Stay"
            )
            if (confirmed) {
                clearCart()
                logout()
            }
            return
        }

        // CASE 2: Has orders — confirm bill generation
        const confirmed = await showConfirm(
            "Request Your Bill?",
            "This will generate your bill. You can print or save it as PDF.",
            "Get Bill",
            "Not Yet"
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
                showError("Bill Generation Failed", data.error || 'Unknown error')
            }
        } catch (error) {
            console.error(error)
            showError("Something Went Wrong", "Failed to generate bill. Please ask a waiter directly.")
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                    {orders.map(order => {
                        const statusConfig: any = {
                            pending: { icon: Clock, color: '#F59E0B', label: 'Preparing', bg: 'rgba(245, 158, 11, 0.1)' },
                            ready: { icon: CheckCircle2, color: 'var(--primary)', label: 'Ready', bg: 'rgba(var(--primary-rgb), 0.1)' },
                            completed: { icon: CheckCircle2, color: '#10B981', label: 'Done', bg: 'rgba(16, 185, 129, 0.1)' },
                            cancelled: { icon: XCircle, color: '#EF4444', label: 'Cancelled', bg: 'rgba(239, 68, 68, 0.1)' }
                        }
                        const config = statusConfig[order.status] || statusConfig.pending
                        const StatusIcon = config.icon
                        const isExpanded = expandedOrder === order.id
                        const itemCount = order.items?.length || 0
                        const firstItem = order.notes === 'REGULAR_STAFF_MEAL' ? 'Staff Meal' : order.items?.[0]?.menu_item?.name || 'Order'
                        const summary = itemCount > 1 ? `${firstItem} +${itemCount - 1} more` : firstItem

                        return (
                            <div
                                key={order.id}
                                style={{
                                    background: 'var(--surface)',
                                    borderRadius: 'var(--radius)',
                                    border: '1px solid var(--border)',
                                    boxShadow: 'var(--shadow-sm)',
                                    overflow: 'hidden',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                                onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                            >
                                {/* Compact header row */}
                                <div style={{
                                    padding: '14px 16px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px'
                                }}>
                                    <StatusIcon size={20} color={config.color} />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                                            <span style={{
                                                fontWeight: 700,
                                                fontSize: '0.9rem',
                                                color: 'var(--text)',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                                maxWidth: '60%'
                                            }}>
                                                {summary}
                                            </span>
                                            <span style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '1rem', flexShrink: 0 }}>
                                                ₹{order.total.toFixed(0)}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                            <span style={{
                                                fontWeight: 700,
                                                color: config.color,
                                                background: config.bg,
                                                padding: '1px 8px',
                                                borderRadius: '4px',
                                                fontSize: '0.7rem',
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.03em'
                                            }}>
                                                {config.label}
                                            </span>
                                            <span>{new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            <span>•</span>
                                            <span>{order.table_name}</span>
                                        </div>
                                    </div>
                                    <ChevronDown
                                        size={18}
                                        color="var(--text-muted)"
                                        style={{
                                            transition: 'transform 0.2s',
                                            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                            flexShrink: 0
                                        }}
                                    />
                                </div>

                                {/* Expanded details */}
                                {isExpanded && (
                                    <div style={{
                                        padding: '0 16px 14px',
                                        borderTop: '1px solid var(--border)'
                                    }}>
                                        <div style={{ padding: '12px 0' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                <span>#{order.id.slice(0, 8).toUpperCase()}</span>
                                                <span>{order.num_guests || 1} Guest{(order.num_guests || 1) > 1 ? 's' : ''}</span>
                                            </div>
                                            <div style={{
                                                background: 'var(--background)',
                                                borderRadius: 'var(--radius-sm)',
                                                padding: '10px 12px',
                                                border: '1px solid var(--border)'
                                            }}>
                                                {order.notes === 'REGULAR_STAFF_MEAL' ? (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', fontWeight: 600, fontSize: '0.85rem' }}>
                                                        <Utensils size={14} />
                                                        <span>Standard Regular Staff Meal</span>
                                                    </div>
                                                ) : (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                        {order.items?.map((item: any) => (
                                                            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 600 }}>
                                                                <span>{item.quantity}x {item.menu_item?.name}</span>
                                                                <span style={{ color: 'var(--text-muted)' }}>₹{(item.quantity * item.price).toFixed(0)}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            {order.notes && order.notes !== 'REGULAR_STAFF_MEAL' && (
                                                <div style={{ marginTop: '8px', fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                                    Note: {order.notes}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
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
