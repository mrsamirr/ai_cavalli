'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Suspense, useEffect, useState } from 'react'
import { supabase } from '@/lib/database/supabase'

function GuestOrderContent() {
    const searchParams = useSearchParams()
    const orderId = searchParams.get('orderId')
    const [order, setOrder] = useState<any>(null)
    const [recentOrders, setRecentOrders] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    const fetchStatus = async () => {
        if (!orderId) {
            setLoading(false)
            return
        }
        const { data } = await supabase
            .from('orders')
            .select(`
                id, status, table_name, total, guest_info,
                items:order_items(
                    id,
                    quantity,
                    price,
                    menu_item:menu_items(name)
                )
            `)
            .eq('id', orderId)
            .single()

        if (data) setOrder(data)

        // Fetch recent orders for this guest phone
        const guestPhone = localStorage.getItem('guest_phone')
        if (guestPhone) {
            const { data: others } = await supabase
                .from('orders')
                .select('id, status, total, created_at')
                .contains('guest_info', { phone: guestPhone })
                .order('created_at', { ascending: false })
                .limit(10)

            if (others) setRecentOrders(others)
        }

        setLoading(false)
    }

    useEffect(() => {
        fetchStatus()

        if (!orderId) return

        const channel = supabase
            .channel(`guest-order-${orderId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'orders',
                    filter: `id=eq.${orderId}`
                },
                (payload) => {
                    console.log('Guest order status updated:', payload)
                    fetchStatus()
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [orderId])

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
                        <span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{orderId.slice(0, 8)}</span>
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
                            {order?.items?.map((item: any) => (
                                <li key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                                    <span>{item.quantity}x {item.menu_item?.name}</span>
                                    <span>₹{(item.quantity * item.price).toFixed(2)}</span>
                                </li>
                            ))}
                        </ul>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', fontWeight: 'bold', borderTop: '1px dashed #ccc', paddingTop: '0.5rem' }}>
                            <span>Total</span>
                            <span>₹{order?.total?.toFixed(2)}</span>
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
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(prev.created_at).toLocaleDateString()}</div>
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
