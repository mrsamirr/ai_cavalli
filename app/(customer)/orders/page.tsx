'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/database/supabase'
import { useAuth } from '@/lib/auth/context'

import { useSearchParams } from 'next/navigation'
import { ChevronLeft, Package, Clock, CheckCircle2, XCircle } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Loading } from '@/components/ui/Loading'

export default function OrdersPage() {
    const { user } = useAuth()
    const searchParams = useSearchParams()
    const orderIdParam = searchParams.get('orderId')

    const [orders, setOrders] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        // If neither user nor orderIdParam, we can't show anything
        if (!user && !orderIdParam) {
            setLoading(false)
            return
        }

        async function fetchOrders() {
            let query = supabase.from('orders').select('*')

            if (user) {
                query = query.eq('user_id', user.id)
            } else if (orderIdParam) {
                query = query.eq('id', orderIdParam)
            }

            const { data } = await query.order('created_at', { ascending: false })

            if (data) setOrders(data)
            setLoading(false)
        }

        fetchOrders()

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

    if (loading) {
        return <Loading fullScreen message="Fetching your order status..." />
    }

    return (
        <div className="container fade-in" style={{ paddingTop: 'var(--space-6)', paddingBottom: 'var(--space-12)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-8)' }}>
                <Link href={user ? "/home" : "/menu"} style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center' }}>
                    <ChevronLeft size={32} />
                </Link>
                <h1 style={{ margin: 0, fontSize: '2.5rem', fontFamily: 'var(--font-serif)' }}>
                    {orderIdParam && !user ? 'Order Status' : 'My Orders'}
                </h1>
            </div>

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
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        marginTop: 'var(--space-2)'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                                            <Package size={20} color="var(--primary)" />
                                            <span style={{ fontWeight: 600 }}>Order Total</span>
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
