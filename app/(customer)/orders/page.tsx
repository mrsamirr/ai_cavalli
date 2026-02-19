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
        <div style={{
            minHeight: '100vh',
            background: 'var(--background)',
            paddingBottom: '120px',
        }}>
            {/* Bill Preview Modal */}
            {billPreview && (
                <BillPreviewModal
                    bill={billPreview}
                    onClose={handleBillPreviewClose}
                    onPrintComplete={handlePrintComplete}
                />
            )}

            {/* Hero Header */}
            <div style={{
                background: 'linear-gradient(135deg, var(--primary) 0%, #8B1A1F 100%)',
                padding: 'clamp(1.5rem, 5vw, 2.5rem) clamp(1rem, 4vw, 2rem)',
                paddingTop: 'clamp(2rem, 6vw, 3rem)',
                color: 'white',
                position: 'relative',
                overflow: 'hidden',
            }}>
                {/* Decorative circles */}
                <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '140px', height: '140px', borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
                <div style={{ position: 'absolute', bottom: '-30px', left: '20%', width: '100px', height: '100px', borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />

                <div style={{ maxWidth: '600px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
                    <Link href={user ? "/home" : "/menu"} style={{ color: 'rgba(255,255,255,0.8)', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', fontWeight: 600, textDecoration: 'none', marginBottom: '12px' }}>
                        <ChevronLeft size={18} />
                        Back
                    </Link>
                    <h1 style={{ margin: 0, fontSize: 'clamp(1.75rem, 5vw, 2.25rem)', fontFamily: 'var(--font-serif)', fontWeight: 800, letterSpacing: '-0.02em' }}>
                        {orderIdParam && !user ? 'Order Status' : 'My Orders'}
                    </h1>
                    {orders.length > 0 && (
                        <p style={{ margin: '6px 0 0', opacity: 0.85, fontSize: '0.9rem' }}>
                            {orders.length} order{orders.length !== 1 ? 's' : ''} &middot; ₹{orders.reduce((sum: number, o: any) => sum + (o.total || 0), 0).toFixed(0)} total
                        </p>
                    )}
                </div>
            </div>

            <div style={{ maxWidth: '600px', margin: '0 auto', padding: '0 clamp(1rem, 4vw, 1.5rem)' }}>

                {/* Status Summary Pills */}
                {orders.length > 0 && (
                    <div style={{
                        display: 'flex',
                        gap: '8px',
                        marginTop: '-20px',
                        marginBottom: '20px',
                        position: 'relative',
                        zIndex: 2,
                        overflowX: 'auto',
                        paddingBottom: '4px',
                    }}>
                        {[
                            { key: 'pending', label: 'Preparing', color: '#F59E0B', bg: '#FFFBEB', icon: Clock },
                            { key: 'ready', label: 'Ready', color: 'var(--primary)', bg: '#FEF2F2', icon: CheckCircle2 },
                            { key: 'completed', label: 'Done', color: '#10B981', bg: '#ECFDF5', icon: CheckCircle2 },
                        ].map(s => {
                            const count = orders.filter((o: any) => o.status === s.key).length
                            if (count === 0) return null
                            const SIcon = s.icon
                            return (
                                <div key={s.key} style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    background: s.bg,
                                    border: `1.5px solid ${s.color}20`,
                                    borderRadius: '20px',
                                    padding: '8px 14px',
                                    fontSize: '0.8rem',
                                    fontWeight: 700,
                                    color: s.color,
                                    whiteSpace: 'nowrap',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                                }}>
                                    <SIcon size={14} />
                                    {count} {s.label}
                                </div>
                            )
                        })}
                    </div>
                )}

                {/* Get The Bill Card */}
                {user && (
                    <div style={{
                        marginBottom: '24px',
                        background: orders.length > 0
                            ? 'linear-gradient(135deg, #059669 0%, #047857 100%)'
                            : 'white',
                        borderRadius: '20px',
                        padding: '20px',
                        color: orders.length > 0 ? 'white' : 'var(--text)',
                        boxShadow: orders.length > 0
                            ? '0 8px 24px rgba(5, 150, 105, 0.3)'
                            : '0 2px 12px rgba(0,0,0,0.06)',
                        border: orders.length > 0 ? 'none' : '1.5px solid var(--border)',
                        position: 'relative',
                        overflow: 'hidden',
                    }}>
                        {orders.length > 0 && (
                            <div style={{ position: 'absolute', top: '-15px', right: '-15px', width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px', position: 'relative', zIndex: 1 }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>
                                    {orders.length > 0 ? 'Finalize Your Meal' : 'Ready for the Bill?'}
                                </h3>
                                <p style={{
                                    margin: '4px 0 0',
                                    fontSize: '0.8rem',
                                    opacity: orders.length > 0 ? 0.9 : 0.6,
                                }}>
                                    {orders.length > 0
                                        ? 'Generate your bill and print or save as PDF'
                                        : 'Place an order first, then get your bill here'}
                                </p>
                            </div>
                            <div style={{
                                width: '44px',
                                height: '44px',
                                borderRadius: '12px',
                                background: orders.length > 0 ? 'rgba(255,255,255,0.15)' : 'rgba(16, 185, 129, 0.1)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                            }}>
                                <Receipt size={22} color={orders.length > 0 ? 'white' : '#10B981'} />
                            </div>
                        </div>
                        <button
                            onClick={handleGetBill}
                            disabled={endingSession}
                            style={{
                                width: '100%',
                                height: '48px',
                                borderRadius: '14px',
                                background: orders.length > 0 ? 'white' : 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                                color: orders.length > 0 ? '#059669' : 'white',
                                fontWeight: 800,
                                fontSize: '0.95rem',
                                border: 'none',
                                cursor: endingSession ? 'not-allowed' : 'pointer',
                                letterSpacing: '0.02em',
                                transition: 'all 0.2s ease',
                                boxShadow: orders.length > 0 ? 'none' : '0 4px 12px rgba(16, 185, 129, 0.25)',
                                opacity: endingSession ? 0.7 : 1,
                                position: 'relative',
                                zIndex: 1,
                            }}
                        >
                            {endingSession ? 'Processing...' : 'GET THE BILL'}
                        </button>
                    </div>
                )}

                {/* Orders List */}
                {orders.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {orders.map((order, index) => {
                            const statusConfig: any = {
                                pending: { icon: Clock, color: '#F59E0B', label: 'Preparing', bg: '#FFFBEB', borderColor: '#FDE68A' },
                                ready: { icon: CheckCircle2, color: 'var(--primary)', label: 'Ready to Serve', bg: '#FEF2F2', borderColor: '#FECACA' },
                                completed: { icon: CheckCircle2, color: '#10B981', label: 'Completed', bg: '#ECFDF5', borderColor: '#A7F3D0' },
                                cancelled: { icon: XCircle, color: '#EF4444', label: 'Cancelled', bg: '#FEF2F2', borderColor: '#FECACA' }
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
                                        background: 'white',
                                        borderRadius: '16px',
                                        border: `1.5px solid ${isExpanded ? config.borderColor : 'var(--border)'}`,
                                        boxShadow: isExpanded ? `0 4px 16px ${config.color}15` : '0 1px 4px rgba(0,0,0,0.04)',
                                        overflow: 'hidden',
                                        cursor: 'pointer',
                                        transition: 'all 0.25s ease',
                                    }}
                                    onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                                >
                                    {/* Status accent bar */}
                                    <div style={{ height: '3px', background: config.color, opacity: 0.8 }} />

                                    {/* Order header */}
                                    <div style={{
                                        padding: '14px 16px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                    }}>
                                        {/* Status icon with pulse for pending */}
                                        <div style={{
                                            width: '38px',
                                            height: '38px',
                                            borderRadius: '10px',
                                            background: config.bg,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flexShrink: 0,
                                            position: 'relative',
                                        }}>
                                            <StatusIcon size={18} color={config.color} />
                                            {order.status === 'pending' && (
                                                <div style={{
                                                    position: 'absolute',
                                                    top: '-2px',
                                                    right: '-2px',
                                                    width: '10px',
                                                    height: '10px',
                                                    borderRadius: '50%',
                                                    background: '#F59E0B',
                                                    border: '2px solid white',
                                                    animation: 'pulse 2s infinite',
                                                }} />
                                            )}
                                        </div>

                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px' }}>
                                                <span style={{
                                                    fontWeight: 700,
                                                    fontSize: '0.95rem',
                                                    color: 'var(--text)',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap',
                                                    maxWidth: '55%',
                                                }}>
                                                    {summary}
                                                </span>
                                                <span style={{
                                                    fontWeight: 800,
                                                    color: 'var(--text)',
                                                    fontSize: '1rem',
                                                    flexShrink: 0,
                                                }}>
                                                    ₹{order.total.toFixed(0)}
                                                </span>
                                            </div>
                                            <div style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                fontSize: '0.75rem',
                                                color: 'var(--text-muted)',
                                            }}>
                                                <span style={{
                                                    fontWeight: 700,
                                                    color: config.color,
                                                    fontSize: '0.7rem',
                                                    textTransform: 'uppercase',
                                                    letterSpacing: '0.04em',
                                                }}>
                                                    {config.label}
                                                </span>
                                                <span style={{ opacity: 0.4 }}>&middot;</span>
                                                <span>{new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                {order.table_name && (
                                                    <>
                                                        <span style={{ opacity: 0.4 }}>&middot;</span>
                                                        <span>{order.table_name}</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        <ChevronDown
                                            size={16}
                                            color="var(--text-muted)"
                                            style={{
                                                transition: 'transform 0.25s ease',
                                                transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                                flexShrink: 0,
                                                opacity: 0.5,
                                            }}
                                        />
                                    </div>

                                    {/* Expanded details */}
                                    {isExpanded && (
                                        <div style={{
                                            padding: '0 16px 16px',
                                            borderTop: '1px solid var(--border)',
                                        }}>
                                            <div style={{ paddingTop: '12px' }}>
                                                {/* Order ID & guests */}
                                                <div style={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    marginBottom: '12px',
                                                    fontSize: '0.75rem',
                                                    color: 'var(--text-muted)',
                                                    fontWeight: 600,
                                                }}>
                                                    <span style={{ fontFamily: 'monospace', letterSpacing: '0.05em' }}>#{order.id.slice(0, 8).toUpperCase()}</span>
                                                    <span>{order.num_guests || 1} Guest{(order.num_guests || 1) > 1 ? 's' : ''}</span>
                                                </div>

                                                {/* Items list */}
                                                <div style={{
                                                    background: 'var(--background)',
                                                    borderRadius: '12px',
                                                    padding: '12px 14px',
                                                    border: '1px solid var(--border)',
                                                }}>
                                                    {order.notes === 'REGULAR_STAFF_MEAL' ? (
                                                        <div style={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '10px',
                                                            color: 'var(--primary)',
                                                            fontWeight: 700,
                                                            fontSize: '0.9rem',
                                                        }}>
                                                            <div style={{
                                                                width: '32px',
                                                                height: '32px',
                                                                borderRadius: '8px',
                                                                background: 'rgba(var(--primary-rgb), 0.1)',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                            }}>
                                                                <Utensils size={16} />
                                                            </div>
                                                            Standard Regular Staff Meal
                                                        </div>
                                                    ) : (
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                            {order.items?.map((item: any, i: number) => (
                                                                <div key={item.id} style={{
                                                                    display: 'flex',
                                                                    justifyContent: 'space-between',
                                                                    alignItems: 'center',
                                                                    fontSize: '0.87rem',
                                                                    paddingBottom: i < order.items.length - 1 ? '8px' : 0,
                                                                    borderBottom: i < order.items.length - 1 ? '1px solid var(--border)' : 'none',
                                                                }}>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                        <span style={{
                                                                            width: '22px',
                                                                            height: '22px',
                                                                            borderRadius: '6px',
                                                                            background: 'rgba(var(--primary-rgb), 0.08)',
                                                                            color: 'var(--primary)',
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            justifyContent: 'center',
                                                                            fontSize: '0.7rem',
                                                                            fontWeight: 800,
                                                                            flexShrink: 0,
                                                                        }}>
                                                                            {item.quantity}
                                                                        </span>
                                                                        <span style={{ fontWeight: 600, color: 'var(--text)' }}>{item.menu_item?.name}</span>
                                                                    </div>
                                                                    <span style={{ fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                                                        ₹{(item.quantity * item.price).toFixed(0)}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Total row */}
                                                <div style={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    marginTop: '10px',
                                                    padding: '8px 0 0',
                                                    fontSize: '0.9rem',
                                                    fontWeight: 800,
                                                }}>
                                                    <span style={{ color: 'var(--text-muted)' }}>Order Total</span>
                                                    <span style={{ color: 'var(--primary)' }}>₹{order.total.toFixed(0)}</span>
                                                </div>

                                                {/* Notes */}
                                                {order.notes && order.notes !== 'REGULAR_STAFF_MEAL' && (
                                                    <div style={{
                                                        marginTop: '10px',
                                                        padding: '8px 12px',
                                                        background: '#FFFBEB',
                                                        borderRadius: '8px',
                                                        fontSize: '0.8rem',
                                                        color: '#92400E',
                                                        fontStyle: 'italic',
                                                        border: '1px solid #FDE68A',
                                                    }}>
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
                    <div style={{
                        textAlign: 'center',
                        padding: '48px 24px',
                        background: 'white',
                        borderRadius: '20px',
                        border: '1px solid var(--border)',
                        marginTop: '20px',
                        boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
                    }}>
                        <div style={{
                            width: '72px',
                            height: '72px',
                            borderRadius: '50%',
                            background: 'var(--background)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 16px',
                        }}>
                            <Package size={32} color="var(--text-muted)" strokeWidth={1.5} />
                        </div>
                        <h2 style={{ fontSize: '1.25rem', marginBottom: '8px', fontWeight: 800, color: 'var(--text)' }}>No Orders Yet</h2>
                        <p style={{ color: 'var(--text-muted)', marginBottom: '24px', fontSize: '0.9rem', lineHeight: 1.5 }}>
                            Your orders will appear here once you place them from the menu.
                        </p>
                        <Link href="/menu" style={{ textDecoration: 'none' }}>
                            <button style={{
                                background: 'var(--primary)',
                                color: 'white',
                                border: 'none',
                                padding: '12px 32px',
                                borderRadius: '14px',
                                fontWeight: 700,
                                fontSize: '0.95rem',
                                cursor: 'pointer',
                                boxShadow: '0 4px 12px rgba(var(--primary-rgb), 0.25)',
                            }}>
                                Browse Menu
                            </button>
                        </Link>
                    </div>
                )}
            </div>

            {/* Pulse animation for pending orders */}
            <style>{`
                @keyframes pulse {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.5; transform: scale(1.2); }
                }
            `}</style>
        </div>
    )
}
