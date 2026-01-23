'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Utensils } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Suspense, useEffect, useState } from 'react'
import { supabase } from '@/lib/database/supabase'
import { sanitizePhone } from '@/lib/utils/phone'

function GuestOrderContent() {
    const searchParams = useSearchParams()
    const orderId = searchParams.get('orderId')
    const [order, setOrder] = useState<any>(null)
    const [recentOrders, setRecentOrders] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    const fetchStatus = async () => {
        let activeOrderId = orderId
        const guestPhone = localStorage.getItem('guest_phone')

        // If no Order ID in URL, try to find the latest one for this guest
        if (!activeOrderId && guestPhone) {
            const { data: latest } = await supabase
                .from('orders')
                .select('id')
                .contains('guest_info', { phone: guestPhone })
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle()

            if (latest) activeOrderId = latest.id
        }

        if (!activeOrderId) {
            setLoading(false)
            return
        }

        const { data } = await supabase
            .from('orders')
            .select(`
                id, status, table_name, total, discount_amount, guest_info, num_guests, notes,
                items:order_items(
                    *,
                    menu_item:menu_items(name)
                )
            `)
            .eq('id', activeOrderId)
            .single()

        if (data) setOrder(data)

        // Fetch recent orders history
        if (guestPhone) {
            const finalPhone = sanitizePhone(guestPhone)
            if (guestPhone !== finalPhone) {
                localStorage.setItem('guest_phone', finalPhone)
            }

            const { data: others } = await supabase
                .from('orders')
                .select(`
                    id, status, total, discount_amount, created_at,
                    items:order_items(
                        *,
                        menu_item:menu_items(name)
                    )
                `)
                .contains('guest_info', { phone: finalPhone })
                .order('created_at', { ascending: false })
                .limit(10)

            if (others) setRecentOrders(others)
        }

        setLoading(false)
    }

    useEffect(() => {
        fetchStatus()
    }, [orderId])

    useEffect(() => {
        const targetId = orderId || order?.id
        if (!targetId) return

        const channel = supabase
            .channel(`guest-order-${targetId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'orders',
                    filter: `id=eq.${targetId}`
                },
                (payload) => {
                    fetchStatus()
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [orderId, order?.id])

    if (loading && orderId) return <p>Checking order status...</p>

    return (
        <div style={{
            background: 'var(--surface)',
            padding: '2rem',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--border)',
            maxWidth: '500px',
            margin: '0 auto',
            textAlign: 'center'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                <Link href="/guest/menu" style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center' }}>
                    <ChevronLeft size={24} />
                </Link>
                <h1 style={{ margin: 0, fontSize: '1.5rem', color: 'var(--primary)', fontFamily: 'var(--font-serif)' }}>
                    {order?.status === 'ready' ? 'Delicious News!' :
                        order?.status === 'completed' ? 'Enjoy Your Meal!' :
                            'Order Received'}
                </h1>
            </div>

            <div style={{ marginBottom: '2rem' }}>
                <div style={{
                    display: 'inline-block',
                    padding: '0.5rem 1.5rem',
                    borderRadius: '50px',
                    fontSize: '1.2rem',
                    fontWeight: 'bold',
                    textTransform: 'uppercase',
                    background: order?.status === 'preparing' ? '#dbeafe' :
                        order?.status === 'ready' ? '#dcfce7' :
                            order?.status === 'completed' ? '#f3f4f6' : '#ffedd5',
                    color: order?.status === 'preparing' ? '#1d4ed8' :
                        order?.status === 'ready' ? '#15803d' :
                            order?.status === 'completed' ? '#374151' : '#c2410c',
                    border: '2px solid currentColor'
                }}>
                    {order?.status || 'Pending'}
                </div>
            </div>

            {orderId && (
                <div style={{ background: '#f5f5f5', padding: '1rem', borderRadius: '8px', marginBottom: '2rem', textAlign: 'left' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '0.8rem', color: '#666' }}>Name:</span>
                        <span style={{ fontWeight: 600 }}>{order?.guest_info?.name || 'Guest'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '0.8rem', color: '#666' }}>Phone:</span>
                        <span style={{ fontWeight: 600 }}>{order?.guest_info?.phone || 'N/A'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '0.8rem', color: '#666' }}>Order ID:</span>
                        <span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{orderId.slice(0, 8).toUpperCase()}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '0.8rem', color: '#666' }}>Table/Room:</span>
                        <span style={{ fontWeight: 600 }}>{order?.table_name}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                        <span style={{ fontSize: '0.8rem', color: '#666' }}>Guests:</span>
                        <span style={{ fontWeight: 600 }}>{order?.num_guests || 1}</span>
                    </div>

                    <div style={{ borderTop: '1px solid #ddd', paddingTop: '1rem' }}>
                        <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem', color: '#444' }}>Order Summary</h4>
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                            {order?.notes === 'REGULAR_STAFF_MEAL' ? (
                                <li style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 600 }}>
                                    <Utensils size={14} />
                                    <span>Standard Regular Staff Meal</span>
                                </li>
                            ) : (
                                order?.items?.map((item: any) => (
                                    <li key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                                        <span>{item.quantity}x {item.menu_item?.name}</span>
                                        <span>₹{(item.quantity * item.price).toFixed(2)}</span>
                                    </li>
                                ))
                            )}
                        </ul>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderTop: '1px dashed #ccc', paddingTop: '0.8rem', marginTop: '0.8rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#666' }}>
                                <span>Subtotal</span>
                                <span>₹{order?.total?.toFixed(2)}</span>
                            </div>
                            {order?.discount_amount > 0 && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#DC2626', fontWeight: 600 }}>
                                    <span>Discount</span>
                                    <span>-{order?.discount_amount}%</span>
                                </div>
                            )}
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontWeight: 'bold', fontSize: '1.1rem', color: 'var(--primary)' }}>
                                <span>Total</span>
                                <span>₹{order?.total?.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <p style={{ marginBottom: '2rem', color: '#444' }}>
                {order?.status === 'pending' && "The kitchen has received your order and will start cooking soon."}
                {order?.status === 'preparing' && "Our chefs are currently preparing your delicious meal."}
                {order?.status === 'ready' && "Your order is READY! Please collect it or wait for staff delivery."}
                {order?.status === 'completed' && "This order has been fulfilled. We hope you enjoyed it!"}
            </p>

            {recentOrders.length > 1 && (
                <div style={{ textAlign: 'left', marginTop: '3rem' }}>
                    <h3 style={{ fontSize: '1rem', color: 'var(--text-muted)', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Recent Orders</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {recentOrders.map(prev => (
                            <Link
                                key={prev.id}
                                href={`/guest/status?orderId=${prev.id}`}
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '1rem',
                                    background: prev.id === orderId ? 'rgba(var(--primary-rgb), 0.05)' : 'white',
                                    borderRadius: 'var(--radius)',
                                    border: prev.id === orderId ? '1px solid var(--primary)' : '1px solid var(--border)',
                                    textDecoration: 'none',
                                    color: 'inherit',
                                    transition: '0.2s'
                                }}
                            >
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>#{prev.id.slice(0, 8).toUpperCase()}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>{new Date(prev.created_at).toLocaleDateString()}</div>
                                    <div style={{ fontSize: '0.75rem', color: '#666' }}>
                                        {prev.items?.slice(0, 2).map((i: any) => `${i.quantity}x ${i.menu_item?.name}`).join(', ')}
                                        {prev.items?.length > 2 && '...'}
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '0.9rem' }}>₹{prev.total.toFixed(2)}</div>
                                    <div style={{
                                        fontSize: '0.7rem',
                                        textTransform: 'uppercase',
                                        fontWeight: 700,
                                        color: prev.status === 'ready' ? '#15803d' : '#64748b'
                                    }}>{prev.status}</div>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            )}

            <Link href="/guest/menu">
                <Button variant="outline" style={{ width: '100%' }}>Order More</Button>
            </Link>
        </div>
    )
}

export default function GuestOrderSuccessPage() {
    return (
        <div className="container" style={{ paddingTop: '4rem', textAlign: 'center', minHeight: '100vh', background: '#fcfcfc' }}>
            <Suspense fallback={<p>Loading order details...</p>}>
                <GuestOrderContent />
            </Suspense>
        </div>
    )
}
