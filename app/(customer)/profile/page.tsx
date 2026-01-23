'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth/context'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/database/supabase'
import { ChevronLeft, User, Package, LogOut, MessageSquare, ShieldCheck, Utensils } from 'lucide-react'
import Link from 'next/link'
import { Loading } from '@/components/ui/Loading'
import { useCart } from '@/lib/context/CartContext'

export default function ProfilePage() {
    const { signOut, user, role } = useAuth()
    const { clearCart } = useCart()
    const [userDetails, setUserDetails] = useState<any>(null)
    const [orders, setOrders] = useState<any[]>([])
    const [loadingOrders, setLoadingOrders] = useState(true)

    useEffect(() => {
        if (!user) return

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

        fetchUserDetails()
        fetchOrders()

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
                                <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.875rem' }}>{role === 'student' ? 'RIDER' : role?.toUpperCase()} ACCOUNT</p>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-6)', marginBottom: 'var(--space-8)' }}>
                            <div style={{ padding: 'var(--space-4)', background: 'var(--background)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>PHONE NUMBER</p>
                                <p style={{ fontWeight: 700, margin: 0 }}>{userDetails?.phone || 'Not set'}</p>
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
                            <Button
                                onClick={() => window.open('https://wa.me/1234567890', '_blank')}
                                variant="outline"
                                style={{ flex: 1, minWidth: '180px', color: '#075E54', borderColor: '#075E54' }}
                            >
                                <MessageSquare size={18} style={{ marginRight: '8px' }} />
                                Contact Support
                            </Button>
                            <Button onClick={() => { clearCart(); signOut(); }} variant="outline" style={{ flex: 1, minWidth: '180px' }}>
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
